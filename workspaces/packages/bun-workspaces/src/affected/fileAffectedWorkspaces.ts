import path from "path";
import bun from "bun";
import { logger } from "../internal/logger";
import { matchWorkspacesByPatterns, type Workspace } from "../workspaces";
import type {
  ExternalDependencyChange,
  ExternalDependencyChangesByWorkspace,
} from "./externalDependencyChanges";

export type AffectedDependencyEdgeSource = "input" | "package";

export interface AffectedDependencyChainEntry {
  workspaceName: string;
  /**
   * The kind of edge that led to this workspace from the previous chain entry.
   * Undefined for the starting workspace at the head of the chain.
   *
   * "package" means the dependency is a true package.json-resolved dependency.
   *
   * "input" means the dependency comes from the workspace's workspace pattern inputs,
   * from defaultInputs or a script's inputs.
   */
  edgeSource?: AffectedDependencyEdgeSource;
}

export interface AffectedWorkspaceInput {
  workspace: Workspace;
  /** File paths, directories, or glob patterns relative to the workspace's path. Prefix with `!` to exclude. */
  inputFilePatterns: string[];
  /** Workspace patterns to also treat as dependencies, matched against all workspaces in `workspaceInputs` */
  inputWorkspacePatterns: string[];
  /**
   * Filter on which of the workspace's declared external dependencies
   * participate in lockfile-change detection.
   *
   * - `undefined`: no filter — every declared external dep participates.
   * - empty array: no external deps participate.
   * - non-empty list: only entries with names in this list participate.
   *   Names not present in the workspace's actual `externalDependencies`
   *   are silently ignored.
   */
  inputExternalDependencyNames?: string[];
}

export interface AffectedFileResult<
  FileMetadata extends object | undefined = undefined,
> {
  /** The path to the file in the workspace */
  filePath: string;
  /** The matched input path of the file */
  inputPattern: string;
  /** Extra metadata about the file */
  fileMetadata: FileMetadata;
}

export interface AffectedDependencyResult {
  dependencyName: string;
  /** The chain of workspaces that led from the starting workspace to the affected dependency */
  chain: AffectedDependencyChainEntry[];
}

export interface AffectedReasons<
  FileMetadata extends object | undefined = undefined,
> {
  changedFiles: AffectedFileResult<FileMetadata>[];
  dependencies: AffectedDependencyResult[];
  externalDependencies: ExternalDependencyChange[];
}

export interface AffectedWorkspaceResult<
  FileMetadata extends object | undefined = undefined,
> {
  workspace: Workspace;
  isAffected: boolean;
  affectedReasons: AffectedReasons<FileMetadata>;
}

export interface FileAffectedWorkspacesOptions {
  /** For resolving relative workspace paths */
  rootDirectory: string;
  /** The workspaces and their given inputs */
  workspaceInputs: AffectedWorkspaceInput[];
  /** The paths of all files that are considered changed */
  changedFilePaths: string[];
  /** Per-workspace external dep version deltas (from a lockfile compare) */
  externalDepChangesByWorkspace?: ExternalDependencyChangesByWorkspace;
  /** Whether to ignore cascade through workspace `workspace:*` dependencies */
  ignoreWorkspaceDependencies?: boolean;
}

export interface FileAffectedWorkspacesResult<
  FileMetadata extends object | undefined = undefined,
> {
  affectedWorkspaces: AffectedWorkspaceResult<FileMetadata>[];
}

const FILE_PATTERN_NEGATION_PREFIX = "!";

const GLOB_CHARACTER_REGEX = /[*?[{]/;

const toPosixPath = (filePath: string) => filePath.replaceAll("\\", "/");

const stripTrailingSlashes = (filePath: string) => filePath.replace(/\/+$/, "");

const stripLeadingSlashes = (filePath: string) => filePath.replace(/^\/+/, "");

const stripDotSlashSegments = (filePath: string): string => {
  let stripped = filePath;
  while (stripped.startsWith("./")) stripped = stripped.slice(2);
  return stripped === "." ? "" : stripped;
};

const normalizeChangedFilePath = ({
  rootDirectory,
  filePath,
}: {
  rootDirectory: string;
  filePath: string;
}) => {
  const posixFilePath = toPosixPath(filePath);
  if (!path.isAbsolute(filePath)) {
    return stripDotSlashSegments(posixFilePath);
  }
  const posixRoot = stripTrailingSlashes(toPosixPath(rootDirectory));
  if (posixFilePath === posixRoot) {
    return "";
  }
  if (posixRoot && posixFilePath.startsWith(`${posixRoot}/`)) {
    return posixFilePath.slice(posixRoot.length + 1);
  }
  return posixFilePath;
};

const PROJECT_RELATIVE_PREFIX = "/";

const PARENT_SEGMENT = "..";

const resolveInputPattern = ({
  workspacePath,
  inputPattern,
}: {
  workspacePath: string;
  inputPattern: string;
}) => {
  const posixPattern = toPosixPath(inputPattern);

  let rawJoined: string;
  if (posixPattern.startsWith(PROJECT_RELATIVE_PREFIX)) {
    rawJoined = stripLeadingSlashes(posixPattern);
  } else {
    const normalizedWorkspacePath = stripTrailingSlashes(
      toPosixPath(workspacePath),
    );
    const stripped = stripTrailingSlashes(posixPattern);

    if (!normalizedWorkspacePath || normalizedWorkspacePath === ".") {
      rawJoined = stripped;
    } else if (!stripped || stripped === ".") {
      rawJoined = normalizedWorkspacePath;
    } else {
      rawJoined = `${normalizedWorkspacePath}/${stripped}`;
    }
  }

  if (!rawJoined) return "";

  const normalized = path.posix.normalize(rawJoined);
  if (normalized === ".") return "";
  return stripTrailingSlashes(normalized);
};

const isPatternOutsideProject = (resolvedPattern: string): boolean =>
  resolvedPattern === PARENT_SEGMENT ||
  resolvedPattern.startsWith(`${PARENT_SEGMENT}/`);

const matchesResolvedPattern = ({
  filePath,
  resolvedPattern,
}: {
  filePath: string;
  resolvedPattern: string;
}): boolean => {
  if (!resolvedPattern) {
    return true;
  }
  if (GLOB_CHARACTER_REGEX.test(resolvedPattern)) {
    return new bun.Glob(resolvedPattern).match(filePath);
  }
  return (
    filePath === resolvedPattern || filePath.startsWith(`${resolvedPattern}/`)
  );
};

type SplitFilePatterns = {
  includes: string[];
  excludes: string[];
};

const splitFilePatterns = (patterns: string[]): SplitFilePatterns => {
  const includes: string[] = [];
  const excludes: string[] = [];
  for (const pattern of patterns) {
    if (pattern.startsWith(FILE_PATTERN_NEGATION_PREFIX)) {
      excludes.push(pattern.slice(FILE_PATTERN_NEGATION_PREFIX.length));
    } else {
      includes.push(pattern);
    }
  }
  return { includes, excludes };
};

type ResolvedFilePattern = {
  inputPattern: string;
  resolvedPattern: string;
};

const resolveFilePatterns = ({
  workspace,
  patterns,
  isExclude,
}: {
  workspace: Workspace;
  patterns: string[];
  isExclude: boolean;
}): ResolvedFilePattern[] => {
  const resolved: ResolvedFilePattern[] = [];
  for (const inputPattern of patterns) {
    const resolvedPattern = resolveInputPattern({
      workspacePath: workspace.path,
      inputPattern,
    });
    if (isPatternOutsideProject(resolvedPattern)) {
      const displayPattern = isExclude
        ? `${FILE_PATTERN_NEGATION_PREFIX}${inputPattern}`
        : inputPattern;
      logger.warn(
        `Input pattern ${JSON.stringify(displayPattern)} for workspace "${workspace.name}" resolves outside the project root and will be ignored.`,
      );
      continue;
    }
    resolved.push({ inputPattern, resolvedPattern });
  }
  return resolved;
};

const matchChangedFilesForWorkspace = ({
  workspace,
  inputFilePatterns,
  changedFilePaths,
}: {
  workspace: Workspace;
  inputFilePatterns: string[];
  changedFilePaths: string[];
}): AffectedFileResult[] => {
  const { includes, excludes } = splitFilePatterns(inputFilePatterns);

  const resolvedIncludes = resolveFilePatterns({
    workspace,
    patterns: includes,
    isExclude: false,
  });
  const resolvedExcludes = resolveFilePatterns({
    workspace,
    patterns: excludes,
    isExclude: true,
  });

  const matchedFiles: AffectedFileResult[] = [];
  const matchedFilePaths = new Set<string>();

  for (const filePath of changedFilePaths) {
    if (matchedFilePaths.has(filePath)) continue;

    const matchingInclude = resolvedIncludes.find(({ resolvedPattern }) =>
      matchesResolvedPattern({ filePath, resolvedPattern }),
    );
    if (!matchingInclude) continue;

    const isExcluded = resolvedExcludes.some(({ resolvedPattern }) =>
      matchesResolvedPattern({ filePath, resolvedPattern }),
    );
    if (isExcluded) continue;

    matchedFiles.push({
      filePath,
      fileMetadata: undefined,
      inputPattern: matchingInclude.inputPattern,
    });
    matchedFilePaths.add(filePath);
  }

  return matchedFiles;
};

const resolveInputWorkspaceDependencies = ({
  workspaceInputs,
}: {
  workspaceInputs: AffectedWorkspaceInput[];
}): Map<string, string[]> => {
  const inputDependenciesByName = new Map<string, string[]>();
  const allWorkspaces = workspaceInputs.map(({ workspace }) => workspace);

  for (const { workspace, inputWorkspacePatterns } of workspaceInputs) {
    if (inputWorkspacePatterns.length === 0) {
      inputDependenciesByName.set(workspace.name, []);
      continue;
    }
    const matchedNames = matchWorkspacesByPatterns(
      inputWorkspacePatterns,
      allWorkspaces,
    )
      .map((matchedWorkspace) => matchedWorkspace.name)
      .filter((matchedName) => matchedName !== workspace.name);
    inputDependenciesByName.set(workspace.name, matchedNames);
  }

  return inputDependenciesByName;
};

type AffectedDependencyEdge = {
  dependencyName: string;
  edgeSource: AffectedDependencyEdgeSource;
};

const collectDirectEdges = ({
  workspace,
  inputDependenciesByName,
  ignoreWorkspaceDependencies,
}: {
  workspace: Workspace;
  inputDependenciesByName: Map<string, string[]>;
  ignoreWorkspaceDependencies: boolean;
}): AffectedDependencyEdge[] => {
  const edges: AffectedDependencyEdge[] = [];
  for (const dependencyName of inputDependenciesByName.get(workspace.name) ??
    []) {
    edges.push({ dependencyName, edgeSource: "input" });
  }
  if (!ignoreWorkspaceDependencies) {
    for (const dependencyName of workspace.dependencies) {
      edges.push({ dependencyName, edgeSource: "package" });
    }
  }
  return edges;
};

const computeAffectedWorkspaceSet = ({
  workspaceInputs,
  workspaceByName,
  changedFilesByName,
  externalDepChangesByWorkspace,
  inputDependenciesByName,
  ignoreWorkspaceDependencies,
}: {
  workspaceInputs: AffectedWorkspaceInput[];
  workspaceByName: Map<string, Workspace>;
  changedFilesByName: Map<string, AffectedFileResult[]>;
  externalDepChangesByWorkspace: ExternalDependencyChangesByWorkspace;
  inputDependenciesByName: Map<string, string[]>;
  ignoreWorkspaceDependencies: boolean;
}): Set<string> => {
  const inputDependentsByName = new Map<string, string[]>();
  for (const [workspaceName, dependencyNames] of inputDependenciesByName) {
    for (const dependencyName of dependencyNames) {
      const existing = inputDependentsByName.get(dependencyName);
      if (existing) {
        existing.push(workspaceName);
      } else {
        inputDependentsByName.set(dependencyName, [workspaceName]);
      }
    }
  }

  const affected = new Set<string>();
  const queue: string[] = [];

  for (const { workspace } of workspaceInputs) {
    const hasChangedFiles =
      (changedFilesByName.get(workspace.name)?.length ?? 0) > 0;
    const hasExternalDepChanges =
      (externalDepChangesByWorkspace.get(workspace.name)?.length ?? 0) > 0;
    if (hasChangedFiles || hasExternalDepChanges) {
      affected.add(workspace.name);
      queue.push(workspace.name);
    }
  }

  while (queue.length > 0) {
    const currentName = queue.shift()!;
    const currentWorkspace = workspaceByName.get(currentName);

    const dependents = [
      ...(inputDependentsByName.get(currentName) ?? []),
      ...(!ignoreWorkspaceDependencies && currentWorkspace
        ? currentWorkspace.dependents
        : []),
    ];

    for (const dependentName of dependents) {
      if (!workspaceByName.has(dependentName)) continue;
      if (affected.has(dependentName)) continue;
      affected.add(dependentName);
      queue.push(dependentName);
    }
  }

  return affected;
};

/**
 * Walk forward from `directDependencyName` through the affected dep graph,
 * appending each next affected dep edge to the chain until we run out of
 * affected dep edges to follow. Stops on:
 *   - no further affected dep edges,
 *   - revisiting a workspace already in the chain (cycle).
 *
 * Branching is broken deterministically by edge insertion order
 * (input edges before package edges, declaration order within each).
 */
const extendChainThroughAffectedDeps = ({
  startingWorkspaceName,
  directDependencyName,
  directEdgeSource,
  workspaceByName,
  inputDependenciesByName,
  affectedSet,
  ignoreWorkspaceDependencies,
}: {
  startingWorkspaceName: string;
  directDependencyName: string;
  directEdgeSource: AffectedDependencyEdgeSource;
  workspaceByName: Map<string, Workspace>;
  inputDependenciesByName: Map<string, string[]>;
  affectedSet: Set<string>;
  ignoreWorkspaceDependencies: boolean;
}): AffectedDependencyChainEntry[] => {
  const chain: AffectedDependencyChainEntry[] = [
    { workspaceName: startingWorkspaceName },
    { workspaceName: directDependencyName, edgeSource: directEdgeSource },
  ];
  const visited = new Set<string>([
    startingWorkspaceName,
    directDependencyName,
  ]);

  let currentName = directDependencyName;
  while (true) {
    const currentWorkspace = workspaceByName.get(currentName);
    if (!currentWorkspace) break;

    const nextEdge = collectDirectEdges({
      workspace: currentWorkspace,
      inputDependenciesByName,
      ignoreWorkspaceDependencies,
    }).find(
      ({ dependencyName }) =>
        !visited.has(dependencyName) &&
        workspaceByName.has(dependencyName) &&
        affectedSet.has(dependencyName),
    );
    if (!nextEdge) break;

    chain.push({
      workspaceName: nextEdge.dependencyName,
      edgeSource: nextEdge.edgeSource,
    });
    visited.add(nextEdge.dependencyName);
    currentName = nextEdge.dependencyName;
  }

  return chain;
};

const collectAffectedDependencies = ({
  startingWorkspace,
  workspaceByName,
  inputDependenciesByName,
  affectedSet,
  ignoreWorkspaceDependencies,
}: {
  startingWorkspace: Workspace;
  workspaceByName: Map<string, Workspace>;
  inputDependenciesByName: Map<string, string[]>;
  affectedSet: Set<string>;
  ignoreWorkspaceDependencies: boolean;
}): AffectedDependencyResult[] => {
  const results: AffectedDependencyResult[] = [];
  const seen = new Set<string>([startingWorkspace.name]);

  const directEdges = collectDirectEdges({
    workspace: startingWorkspace,
    inputDependenciesByName,
    ignoreWorkspaceDependencies,
  });

  for (const { dependencyName, edgeSource } of directEdges) {
    if (seen.has(dependencyName)) continue;
    if (!workspaceByName.has(dependencyName)) continue;
    seen.add(dependencyName);
    if (!affectedSet.has(dependencyName)) continue;

    results.push({
      dependencyName,
      chain: extendChainThroughAffectedDeps({
        startingWorkspaceName: startingWorkspace.name,
        directDependencyName: dependencyName,
        directEdgeSource: edgeSource,
        workspaceByName,
        inputDependenciesByName,
        affectedSet,
        ignoreWorkspaceDependencies,
      }),
    });
  }

  return results;
};

const filterExternalDepChangesByInputs = ({
  changesByWorkspace,
  workspaceInputs,
}: {
  changesByWorkspace: ExternalDependencyChangesByWorkspace;
  workspaceInputs: AffectedWorkspaceInput[];
}): ExternalDependencyChangesByWorkspace => {
  const filtered: ExternalDependencyChangesByWorkspace = new Map();
  for (const { workspace, inputExternalDependencyNames } of workspaceInputs) {
    const changes = changesByWorkspace.get(workspace.name);
    if (!changes?.length) continue;
    if (inputExternalDependencyNames === undefined) {
      filtered.set(workspace.name, changes);
      continue;
    }
    if (inputExternalDependencyNames.length === 0) continue;
    const allowed = new Set(inputExternalDependencyNames);
    const matched = changes.filter((change) => allowed.has(change.name));
    if (matched.length) filtered.set(workspace.name, matched);
  }
  return filtered;
};

export const getFileAffectedWorkspaces = async ({
  rootDirectory,
  workspaceInputs,
  changedFilePaths,
  externalDepChangesByWorkspace = new Map(),
  ignoreWorkspaceDependencies = false,
}: FileAffectedWorkspacesOptions): Promise<FileAffectedWorkspacesResult> => {
  const normalizedChangedFilePaths = changedFilePaths.map((filePath) =>
    normalizeChangedFilePath({ rootDirectory, filePath }),
  );

  const workspaceByName = new Map(
    workspaceInputs.map(
      ({ workspace }) => [workspace.name, workspace] as const,
    ),
  );

  const changedFilesByName = new Map<string, AffectedFileResult[]>();
  for (const { workspace, inputFilePatterns } of workspaceInputs) {
    changedFilesByName.set(
      workspace.name,
      matchChangedFilesForWorkspace({
        workspace,
        inputFilePatterns,
        changedFilePaths: normalizedChangedFilePaths,
      }),
    );
  }

  const filteredExternalDepChanges = filterExternalDepChangesByInputs({
    changesByWorkspace: externalDepChangesByWorkspace,
    workspaceInputs,
  });

  const inputDependenciesByName = resolveInputWorkspaceDependencies({
    workspaceInputs,
  });

  const affectedSet = computeAffectedWorkspaceSet({
    workspaceInputs,
    workspaceByName,
    changedFilesByName,
    externalDepChangesByWorkspace: filteredExternalDepChanges,
    inputDependenciesByName,
    ignoreWorkspaceDependencies,
  });

  const affectedWorkspaces = workspaceInputs.map(({ workspace }) => {
    const changedFiles = changedFilesByName.get(workspace.name) ?? [];
    const externalDependencies =
      filteredExternalDepChanges.get(workspace.name) ?? [];
    const dependencies = collectAffectedDependencies({
      startingWorkspace: workspace,
      workspaceByName,
      inputDependenciesByName,
      affectedSet,
      ignoreWorkspaceDependencies,
    });

    return {
      workspace,
      isAffected: affectedSet.has(workspace.name),
      affectedReasons: { changedFiles, dependencies, externalDependencies },
    };
  });

  return { affectedWorkspaces };
};
