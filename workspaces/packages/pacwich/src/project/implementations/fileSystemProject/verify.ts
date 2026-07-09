import fs from "fs";
import path from "path";
import {
  listProjectTrackableFiles,
  matchWorkspaceInputFiles,
} from "../../../inputs";
import {
  stripLeadingSlashes,
  stripTrailingSlashes,
  toPosixPath,
} from "../../../internal/core";
import { logger } from "../../../internal/logger";
import type { PackageManagerAdapter } from "../../../packageManager/adapter";
import {
  extractFileImports,
  normalizeImportSpecifierToPackageName,
} from "../../../verify";
import { matchWorkspacesByPatterns, type Workspace } from "../../../workspaces";
import type { FileSystemProject } from "./fileSystemProject";

const DEFAULT_INPUT_FILE_PATTERN = ".";

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

const FILE_PATTERN_NEGATION_PREFIX = "!";

const GLOB_CHARACTER_REGEX = /[*?[{]/;

/**
 * Normalize a project-relative ignore glob to match the same path shape
 * as `listProjectTrackableFiles` returns. `!` prefixes are stripped with
 * a warning (this is an exception list, re-including with `!` would be
 * a no-op), and a leading `/` is treated as project-relative since
 * every entry is already project-relative.
 */
const normalizeIgnorePattern = (pattern: string): string | null => {
  let normalized = toPosixPath(pattern);
  if (normalized.startsWith(FILE_PATTERN_NEGATION_PREFIX)) {
    logger.warn("IgnoreInputFilesNegationNotHonored", {
      pattern: JSON.stringify(pattern),
    });
    normalized = normalized.slice(FILE_PATTERN_NEGATION_PREFIX.length);
  }
  normalized = stripLeadingSlashes(normalized);
  normalized = stripTrailingSlashes(normalized);
  if (!normalized || normalized === ".") return null;
  return path.posix.normalize(normalized);
};

const matchesIgnorePattern = (filePath: string, pattern: string): boolean => {
  if (GLOB_CHARACTER_REGEX.test(pattern)) {
    return path.matchesGlob(filePath, pattern);
  }
  return filePath === pattern || filePath.startsWith(`${pattern}/`);
};

const hasScannableExtension = (filePath: string): boolean =>
  SCANNABLE_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());

const collectDeclaredDependencyNames = (workspace: Workspace): Set<string> => {
  const declared = new Set<string>(workspace.dependencies);
  for (const externalDep of workspace.externalDependencies) {
    declared.add(externalDep.name);
  }
  return declared;
};

const resolveTargetWorkspaces = (
  project: FileSystemProject,
  workspacePatterns: string[] | undefined,
): Workspace[] => {
  if (workspacePatterns === undefined) return project.workspaces;
  return matchWorkspacesByPatterns(
    workspacePatterns,
    project.workspaces,
    project.rootWorkspace,
  );
};

const filterTrackableFiles = ({
  trackableFiles,
  ignorePatterns,
}: {
  trackableFiles: string[];
  ignorePatterns: string[];
}): string[] => {
  const normalizedIgnores = ignorePatterns
    .map(normalizeIgnorePattern)
    .filter((p): p is string => p !== null);
  return trackableFiles.filter((filePath) => {
    if (!hasScannableExtension(filePath)) return false;
    return !normalizedIgnores.some((pattern) =>
      matchesIgnorePattern(filePath, pattern),
    );
  });
};

type ScanOccurrence = {
  line: number;
  specifier: string;
};

const scanFileForImplicitDeps = ({
  filePath,
  absolutePath,
  workspaceNamesByName,
  importingWorkspaceName,
  declaredDependencyNames,
}: {
  filePath: string;
  absolutePath: string;
  workspaceNamesByName: Set<string>;
  importingWorkspaceName: string;
  declaredDependencyNames: Set<string>;
}): Map<string, ScanOccurrence[]> => {
  let content: string;
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    logger.debug(
      `verify: skipping unreadable file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new Map();
  }
  const imports = extractFileImports(content);
  const occurrencesByDep = new Map<string, ScanOccurrence[]>();
  for (const { specifier, line } of imports) {
    const packageName = normalizeImportSpecifierToPackageName(specifier);
    if (!packageName) continue;
    if (packageName === importingWorkspaceName) continue;
    if (!workspaceNamesByName.has(packageName)) continue;
    if (declaredDependencyNames.has(packageName)) continue;
    const existing = occurrencesByDep.get(packageName);
    if (existing) {
      existing.push({ line, specifier });
    } else {
      occurrencesByDep.set(packageName, [{ line, specifier }]);
    }
  }
  return occurrencesByDep;
};

/** Options for a project's `verify()` and the `pacwich verify` command. */
export type VerifyOptions = {
  /**
   * Workspace patterns to limit which workspaces are scanned. When
   * omitted, every workspace in the project is scanned.
   */
  workspacePatterns?: string[];
  /**
   * When `true`, the returned result's `ok` is `false` if any
   * implicit workspace dependencies were found. Defaults to `false`,
   * in which case `ok` is always `true` (warnings only).
   */
  strict?: boolean;
};

export type ImplicitWorkspaceDependencyMetadataOccurrence = {
  /** 1-based line in the source file where the import statement begins. */
  line: number;
  /**
   * The literal specifier string as it appeared in the source (e.g.
   * `"foo"` or `"foo/utils"`). Useful for distinguishing subpath
   * imports from bare imports in the same file.
   */
  specifier: string;
};

export type ImplicitWorkspaceDependencyMetadataFile = {
  /** Project-relative POSIX path of the file. */
  path: string;
  /** Per-import occurrences sorted by line, then specifier. */
  occurrences: ImplicitWorkspaceDependencyMetadataOccurrence[];
};

/**
 * One implicit workspace dependency: a workspace that imports another
 * workspace's package without declaring it in its `package.json`.
 */
export type ImplicitWorkspaceDependencyMetadata = {
  /** The importing workspace's package.json name. */
  workspace: string;
  /** The imported workspace's package.json name (not declared as a dep). */
  dependency: string;
  /** Files in `workspace` that reference `dependency`. */
  files: ImplicitWorkspaceDependencyMetadataFile[];
  /**
   * Human-readable remediation string. Embedded into the
   * corresponding `VerifyIssue.message`; API/JSON consumers can also
   * read it here when assembling their own report. The version range
   * comes from the active pm adapter so the suggestion matches what
   * `pacwich verify --fix` will eventually write.
   */
  fixHint: string;
};

/**
 * Mapping from verify issue category to the rich metadata shape it
 * carries. Adding a new category in the future means extending this
 * map and updating the verify orchestrator to emit issues of that
 * name.
 */
type IssueNameToMetadata = {
  implicitWorkspaceDependency: ImplicitWorkspaceDependencyMetadata;
};

/** Discriminant naming a verify finding's category. */
export type VerifyIssueName = keyof IssueNameToMetadata;

/** Severity of a verify finding. */
export type VerifyIssueLevel = "warn" | "error";

/**
 * A single verify finding suitable for direct CLI rendering. The
 * CLI iterates `result.errors` and `result.warnings` and writes
 * `message` via `logger.error` or `logger.warn` based on `level`.
 *
 * API consumers can rely on the discriminant `name` to narrow
 * `metadata` to the specific shape for that category.
 */
export type VerifyIssue<Name extends VerifyIssueName = VerifyIssueName> = {
  [K in Name]: {
    name: K;
    level: VerifyIssueLevel;
    /**
     * Human-readable, multi-line description of the finding,
     * including the relevant fix hint. Ready to pass directly to a
     * logger.
     */
    message: string;
    metadata: IssueNameToMetadata[K];
  };
}[Name];

export type VerifyResult = {
  /**
   * `false` if `errors.length > 0`. Project-instantiation errors
   * fail before this method runs, so they never produce `ok: false`.
   * They throw instead.
   */
  ok: boolean;
  /** Findings that fail the verify run. */
  errors: VerifyIssue[];
  /** Findings that don't fail the run but are worth surfacing. */
  warnings: VerifyIssue[];
};

const buildFixHint = ({
  importingWorkspace,
  dependency,
  adapter,
  workspaceByName,
}: {
  importingWorkspace: Workspace;
  dependency: string;
  adapter: PackageManagerAdapter;
  workspaceByName: Map<string, Workspace>;
}): string => {
  const candidate = workspaceByName.get(dependency);
  const version = candidate
    ? adapter.formatImplicitWorkspaceDepVersion({ workspace: candidate })
    : "*";
  const packageJsonRelative = importingWorkspace.path
    ? `${importingWorkspace.path}/package.json`
    : "package.json";
  return (
    `Add ${JSON.stringify(dependency)}: ${JSON.stringify(version)} ` +
    `to the "dependencies" field of ${packageJsonRelative}.`
  );
};

const formatOccurrenceLocations = (
  metadata: ImplicitWorkspaceDependencyMetadata,
): string =>
  metadata.files
    .flatMap((file) =>
      file.occurrences.map((occurrence) => `${file.path}:${occurrence.line}`),
    )
    .join(", ");

const buildImplicitDepIssueMessage = (
  metadata: ImplicitWorkspaceDependencyMetadata,
  level: VerifyIssueLevel,
): string => {
  const prefix = level === "error" ? "[Implicit dependency error] " : "";
  return (
    `${prefix}Workspace ${JSON.stringify(metadata.workspace)} imports ` +
    `${JSON.stringify(metadata.dependency)} but does not declare it as a ` +
    `dependency (${formatOccurrenceLocations(metadata)}).\n  ${metadata.fixHint}`
  );
};

const buildImplicitDepIssue = ({
  metadata,
  level,
}: {
  metadata: ImplicitWorkspaceDependencyMetadata;
  level: VerifyIssueLevel;
}): VerifyIssue<"implicitWorkspaceDependency"> => ({
  name: "implicitWorkspaceDependency",
  level,
  message: buildImplicitDepIssueMessage(metadata, level),
  metadata,
});

export const verifyProject = async (
  project: FileSystemProject,
  adapter: PackageManagerAdapter,
  options: VerifyOptions,
): Promise<VerifyResult> => {
  const strict = options.strict ?? false;
  const ignorePatterns =
    project.config.project.verify.workspaceDependencies.ignoreInputFiles;

  const targetWorkspaces = resolveTargetWorkspaces(
    project,
    options.workspacePatterns,
  );
  if (targetWorkspaces.length === 0) {
    return { ok: true, errors: [], warnings: [] };
  }

  const workspaceNamesByName = new Set(
    project.workspaces.map((workspace) => workspace.name),
  );
  const workspaceByName = new Map(
    project.workspaces.map((workspace) => [workspace.name, workspace]),
  );

  const trackableFiles = await listProjectTrackableFiles({
    rootDirectory: project.rootDirectory,
  });
  const scannableFiles = filterTrackableFiles({
    trackableFiles,
    ignorePatterns,
  });

  const implicitDeps: ImplicitWorkspaceDependencyMetadata[] = [];
  for (const workspace of targetWorkspaces) {
    const workspaceConfig = project.config.workspaces[workspace.name];
    const inputFilePatterns = workspaceConfig?.defaultInputs?.files ?? [
      DEFAULT_INPUT_FILE_PATTERN,
    ];
    const matchedFiles = matchWorkspaceInputFiles({
      workspaceName: workspace.name,
      workspacePath: workspace.path,
      inputFilePatterns,
      projectFilePaths: scannableFiles,
    });
    if (matchedFiles.length === 0) continue;

    const declaredDependencyNames = collectDeclaredDependencyNames(workspace);
    const occurrencesByDep = new Map<string, Map<string, ScanOccurrence[]>>();

    for (const matchedFile of matchedFiles) {
      const absolute = path.resolve(
        project.rootDirectory,
        matchedFile.filePath,
      );
      const scanned = scanFileForImplicitDeps({
        filePath: matchedFile.filePath,
        absolutePath: absolute,
        workspaceNamesByName,
        importingWorkspaceName: workspace.name,
        declaredDependencyNames,
      });
      for (const [depName, occurrences] of scanned) {
        let filesForDep = occurrencesByDep.get(depName);
        if (!filesForDep) {
          filesForDep = new Map();
          occurrencesByDep.set(depName, filesForDep);
        }
        filesForDep.set(matchedFile.filePath, occurrences);
      }
    }

    const depNames = [...occurrencesByDep.keys()].sort();
    for (const depName of depNames) {
      const filesMap = occurrencesByDep.get(depName)!;
      const filePaths = [...filesMap.keys()].sort();
      const files: ImplicitWorkspaceDependencyMetadataFile[] = filePaths.map(
        (filePath) => ({
          path: filePath,
          occurrences: [...filesMap.get(filePath)!].sort(
            (a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier),
          ),
        }),
      );
      implicitDeps.push({
        workspace: workspace.name,
        dependency: depName,
        files,
        fixHint: buildFixHint({
          importingWorkspace: workspace,
          dependency: depName,
          adapter,
          workspaceByName,
        }),
      });
    }
  }

  implicitDeps.sort(
    (a, b) =>
      a.workspace.localeCompare(b.workspace) ||
      a.dependency.localeCompare(b.dependency),
  );

  // Strict mode routes implicit-dep findings to errors (which fail
  // the run); non-strict routes them to warnings. Future categories
  // may always be errors or always be warnings independent of strict.
  const implicitDepLevel: VerifyIssueLevel = strict ? "error" : "warn";
  const implicitDepIssues = implicitDeps.map((metadata) =>
    buildImplicitDepIssue({ metadata, level: implicitDepLevel }),
  );

  const errors: VerifyIssue[] = [];
  const warnings: VerifyIssue[] = [];
  for (const issue of implicitDepIssues) {
    (issue.level === "error" ? errors : warnings).push(issue);
  }

  return { ok: errors.length === 0, errors, warnings };
};
