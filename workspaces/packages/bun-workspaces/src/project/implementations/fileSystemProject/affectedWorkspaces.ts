import fs from "fs";
import path from "path";
import bun from "bun";
import type { WorkspaceInputsConfig } from "bw-common";
import {
  getFileAffectedWorkspaces,
  type AffectedDependencyChainEntry,
  type AffectedDependencyEdgeSource,
  type AffectedWorkspaceInput,
  type AffectedWorkspaceResult as InternalAffectedWorkspaceResult,
} from "../../../affected/fileAffectedWorkspaces";
import type { GitAffectedFileReason } from "../../../affected/gitAffectedFiles";
import {
  getGitAffectedWorkspaces,
  type GitFileMetadata,
} from "../../../affected/gitAffectedWorkspaces";
import type { Workspace } from "../../../workspaces";
import type { FileSystemProject } from "./fileSystemProject";

export type {
  AffectedDependencyChainEntry,
  AffectedDependencyEdgeSource,
  GitAffectedFileReason,
};

export type AffectedChangedFile = {
  /** The path to the file, relative to the project root */
  projectFilePath: string;
  /** The matched input for the file */
  inputMatch: string;
  /** Present when `diffSource` is "git": the reasons for the file being affected */
  gitReasons?: GitAffectedFileReason[];
};

export type AffectedDependency = {
  /** The name of the dependency */
  dependencyName: string;
  /** The chain of dependencies that led to the affected workspace */
  chain: AffectedDependencyChainEntry[];
};

export type AffectedWorkspaceResult = {
  workspace: Workspace;
  inputs: WorkspaceInputsConfig;
  isAffected: boolean;
  affectedReasons: {
    changedFiles: AffectedChangedFile[];
    dependencies: AffectedDependency[];
  };
};

/** The source for changed files */
export type AffectedDiffSource = "git" | "fileList";

export type AffectedWorkspacesMetadata = {
  /** The source for changed files */
  diffSource: AffectedDiffSource;
  /** When `diffSource` is "git" */
  git?: {
    baseRef: string;
    headRef: string;
  };
};

export type AffectedWorkspacesResult = {
  /** Metadata based on the parameters given */
  metadata: AffectedWorkspacesMetadata;
  /** The workspaces and their affected reasons */
  workspaceResults: AffectedWorkspaceResult[];
};

export type BaseAffectedWorkspacesOptions<
  AcceptsScript extends boolean = true,
> = {
  ignorePackageDependencies?: boolean;
} & (AcceptsScript extends true
  ? {
      script?: string;
    }
  : object);

export type GitAffectedWorkspacesOptions<AcceptsScript extends boolean = true> =
  BaseAffectedWorkspacesOptions<AcceptsScript> & {
    /** Whether to use git to determine affected workspaces or a list of given files */
    diffSource: "git";
    diffOptions?: {
      /**
       * The base git ref to compare against.
       *
       * Default is "main" when not provided or
       * when the default is not set by the
       * root config or env var.
       */
      baseRef?: string;
      /**
       * The head git ref to compare against.
       *
       * Default is "HEAD" when not provided.
       */
      headRef?: string;
      /** Exclude untracked files */
      ignoreUntracked?: boolean;
      /** Ignore staged files */
      ignoreStaged?: boolean;
      /** Ignore unstaged files */
      ignoreUnstaged?: boolean;
      /** Exclude any uncommitted files (ignores staged, unstaged, and untracked) */
      ignoreUncommitted?: boolean;
    };
  };

export type FileListAffectedWorkspacesOptions<
  AcceptsScript extends boolean = true,
> = BaseAffectedWorkspacesOptions<AcceptsScript> & {
  /** Whether to use git or a list of given files to determine affected workspaces */
  diffSource: "fileList";
  /**
   * File paths, directories, or glob patterns relative to the project root.
   *
   * - File paths are matched literally. Paths that don't exist on disk
   *   pass through as-is.
   * - Directories are walked recursively into a flat file list. The
   *   `node_modules` and `.git` directories are skipped during the walk.
   * - Globs are expanded via `bun.Glob` against the project root and
   *   only match files that currently exist.
   * - Prefix with `!` to exclude. Exclusions are expanded the same way
   *   and removed from the include set.
   */
  changedFiles: string[];
};

export type DetermineAffectedWorkspacesOptions<
  AcceptScript extends boolean = true,
> =
  | GitAffectedWorkspacesOptions<AcceptScript>
  | FileListAffectedWorkspacesOptions<AcceptScript>;

export const isOptionsForDiffSource = <DiffSource extends AffectedDiffSource>(
  options: DetermineAffectedWorkspacesOptions,
  diffSource: DiffSource,
): options is DiffSource extends "git"
  ? GitAffectedWorkspacesOptions
  : FileListAffectedWorkspacesOptions => options.diffSource === diffSource;

const DEFAULT_INPUT_FILE_PATTERN = ".";

const DEFAULT_HEAD_REF = "HEAD";

/**
 * Patterns added to every workspace's input file patterns when package
 * dependencies are not ignored. The workspace's own `package.json` and the
 * root `package.json` both act as triggers since they declare workspace
 * dependencies and other behavior that affects the workspace.
 */
const IMPLICIT_PACKAGE_JSON_INPUT_PATTERNS = [
  "package.json",
  "/package.json",
] as const;

const FILE_PATTERN_NEGATION_PREFIX = "!";

const GLOB_CHARACTER_REGEX = /[*?[{]/;

const SKIPPED_DIR_NAMES = new Set(["node_modules", ".git"]);

const buildWorkspaceInputs = ({
  project,
  ignorePackageDependencies,
  script,
}: {
  project: FileSystemProject;
  ignorePackageDependencies: boolean;
  script: string | undefined;
}): {
  inputs: AffectedWorkspaceInput[];
  effectiveInputsByName: Map<string, WorkspaceInputsConfig>;
} => {
  const implicitPatterns = ignorePackageDependencies
    ? []
    : [...IMPLICIT_PACKAGE_JSON_INPUT_PATTERNS];
  const effectiveInputsByName = new Map<string, WorkspaceInputsConfig>();
  const inputs = project.workspaces.map<AffectedWorkspaceInput>((workspace) => {
    const workspaceConfig = project.config.workspaces[workspace.name];
    const scriptInputs = script
      ? workspaceConfig?.scripts[script]?.inputs
      : undefined;
    const sourceInputs = scriptInputs ?? workspaceConfig?.defaultInputs ?? {};
    const effectiveFiles = [
      ...new Set([
        ...(sourceInputs.files ?? [DEFAULT_INPUT_FILE_PATTERN]),
        ...implicitPatterns,
      ]),
    ];
    const effectiveWorkspacePatterns = sourceInputs.workspacePatterns ?? [];
    effectiveInputsByName.set(workspace.name, {
      files: effectiveFiles,
      workspacePatterns: effectiveWorkspacePatterns,
    });
    return {
      workspace,
      inputFilePatterns: effectiveFiles,
      inputWorkspacePatterns: effectiveWorkspacePatterns,
    };
  });
  return { inputs, effectiveInputsByName };
};

const normalizeChangedFilesPattern = (pattern: string): string => {
  let normalized = pattern.replaceAll("\\", "/");
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  normalized = normalized.replace(/^\/+/, "").replace(/\/+$/, "");
  if (normalized === ".") return "";
  return normalized;
};

const expandPatternToFiles = ({
  rootDirectory,
  pattern,
}: {
  rootDirectory: string;
  pattern: string;
}): string[] => {
  if (!pattern) return [];
  const normalized = normalizeChangedFilesPattern(pattern);

  if (normalized && GLOB_CHARACTER_REGEX.test(normalized)) {
    return Array.from(
      new bun.Glob(normalized).scanSync({
        cwd: rootDirectory,
        onlyFiles: true,
      }),
    ).map((match) => match.replaceAll("\\", "/"));
  }

  // Empty `normalized` means the input resolved to the project root (e.g. ".")
  const isProjectRoot = normalized === "";
  const absolute = isProjectRoot
    ? rootDirectory
    : path.join(rootDirectory, ...normalized.split("/"));

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    // Pass through paths that don't exist on disk (e.g. deleted files)
    return isProjectRoot ? [] : [normalized];
  }
  if (stat.isFile()) return [normalized];
  if (!stat.isDirectory()) return [];

  const result: string[] = [];
  const walk = (dir: string, baseRel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIPPED_DIR_NAMES.has(entry.name)) continue;
      const rel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile()) {
        result.push(rel);
      }
    }
  };
  walk(absolute, normalized);
  return result;
};

const expandChangedFilesPatterns = ({
  rootDirectory,
  patterns,
}: {
  rootDirectory: string;
  patterns: string[];
}): string[] => {
  const includes = new Set<string>();
  const excludes = new Set<string>();
  for (const pattern of patterns) {
    const isExclude = pattern.startsWith(FILE_PATTERN_NEGATION_PREFIX);
    const stripped = isExclude
      ? pattern.slice(FILE_PATTERN_NEGATION_PREFIX.length)
      : pattern;
    const target = isExclude ? excludes : includes;
    for (const expanded of expandPatternToFiles({
      rootDirectory,
      pattern: stripped,
    })) {
      target.add(expanded);
    }
  }
  for (const excluded of excludes) {
    includes.delete(excluded);
  }
  return [...includes];
};

const toAffectedWorkspaceResult = (
  internal: InternalAffectedWorkspaceResult<GitFileMetadata | undefined>,
  effectiveInputsByName: Map<string, WorkspaceInputsConfig>,
): AffectedWorkspaceResult => ({
  workspace: internal.workspace,
  inputs: effectiveInputsByName.get(internal.workspace.name) ?? {},
  isAffected: internal.isAffected,
  affectedReasons: {
    changedFiles: internal.affectedReasons.changedFiles.map((file) => ({
      projectFilePath: file.filePath,
      inputMatch: file.inputPattern,
      ...(file.fileMetadata?.git && {
        gitReasons: file.fileMetadata.git.reasons,
      }),
    })),
    dependencies: internal.affectedReasons.dependencies,
  },
});

export const determineAffectedWorkspaces = async (
  project: FileSystemProject,
  options: DetermineAffectedWorkspacesOptions<true>,
): Promise<AffectedWorkspacesResult> => {
  const ignorePackageDependencies = options.ignorePackageDependencies ?? false;
  const { inputs: workspaceInputs, effectiveInputsByName } =
    buildWorkspaceInputs({
      project,
      ignorePackageDependencies,
      script: options.script,
    });

  if (isOptionsForDiffSource(options, "git")) {
    const baseRef =
      options.diffOptions?.baseRef ??
      project.config.root.defaults.affectedBaseRef;
    const headRef = options.diffOptions?.headRef ?? DEFAULT_HEAD_REF;

    const { affectedWorkspaces } = await getGitAffectedWorkspaces({
      rootDirectory: project.rootDirectory,
      workspacesOptions: {
        workspaceInputs,
        ignorePackageDependencies,
      },
      gitOptions: {
        baseRef,
        headRef,
        ignoreUntracked: options.diffOptions?.ignoreUntracked,
        ignoreStaged: options.diffOptions?.ignoreStaged,
        ignoreUnstaged: options.diffOptions?.ignoreUnstaged,
        ignoreUncommitted: options.diffOptions?.ignoreUncommitted,
      },
    });

    return {
      metadata: {
        diffSource: "git",
        git: { baseRef, headRef },
      },
      workspaceResults: affectedWorkspaces.map((result) =>
        toAffectedWorkspaceResult(result, effectiveInputsByName),
      ),
    };
  }

  const { affectedWorkspaces } = await getFileAffectedWorkspaces({
    rootDirectory: project.rootDirectory,
    workspaceInputs,
    changedFilePaths: expandChangedFilesPatterns({
      rootDirectory: project.rootDirectory,
      patterns: options.changedFiles,
    }),
    ignorePackageDependencies,
  });

  return {
    metadata: { diffSource: "fileList" },
    workspaceResults: affectedWorkspaces.map((result) =>
      toAffectedWorkspaceResult(result, effectiveInputsByName),
    ),
  };
};
