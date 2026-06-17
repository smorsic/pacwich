import path from "path";
import {
  stripLeadingSlashes,
  stripTrailingSlashes,
  toPosixPath,
} from "../internal/core";
import { logger } from "../internal/logger";

const FILE_PATTERN_NEGATION_PREFIX = "!";

const GLOB_CHARACTER_REGEX = /[*?[{]/;

const PROJECT_RELATIVE_PREFIX = "/";

const PARENT_SEGMENT = "..";

/**
 * Resolve a single input pattern (relative to a workspace, or to the
 * project root when prefixed with `/`) into a project-root-relative
 * POSIX pattern. `..` segments are collapsed via `path.posix.normalize`,
 * and a pattern that resolves to the project root becomes `""` (matches
 * everything).
 */
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
    return path.matchesGlob(filePath, resolvedPattern);
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
  workspaceName,
  workspacePath,
  patterns,
  isExclude,
}: {
  workspaceName: string;
  workspacePath: string;
  patterns: string[];
  isExclude: boolean;
}): ResolvedFilePattern[] => {
  const resolved: ResolvedFilePattern[] = [];
  for (const inputPattern of patterns) {
    const resolvedPattern = resolveInputPattern({
      workspacePath,
      inputPattern,
    });
    if (isPatternOutsideProject(resolvedPattern)) {
      const displayPattern = isExclude
        ? `${FILE_PATTERN_NEGATION_PREFIX}${inputPattern}`
        : inputPattern;
      logger.warn(
        `Input pattern ${JSON.stringify(displayPattern)} for workspace "${workspaceName}" resolves outside the project root and will be ignored.`,
      );
      continue;
    }
    resolved.push({ inputPattern, resolvedPattern });
  }
  return resolved;
};

/** One file matched against a workspace's input patterns. */
export interface InputFileMatch {
  /** Project-relative POSIX path of the matched file. */
  filePath: string;
  /** The (unresolved) include pattern that matched this file. */
  inputPattern: string;
}

export interface MatchWorkspaceInputFilesOptions {
  /** Workspace name, used only for diagnostics. */
  workspaceName: string;
  /** Project-relative POSIX path of the workspace directory. */
  workspacePath: string;
  /**
   * File paths, directories, or glob patterns relative to the
   * workspace's path. Prefix with `!` to exclude. A leading `/` makes
   * the pattern project-root-relative.
   */
  inputFilePatterns: string[];
  /** Candidate project-relative POSIX file paths to match against the patterns. */
  projectFilePaths: string[];
}

/**
 * Match a flat list of project-relative file paths against a single
 * workspace's input patterns. A file matches when it satisfies at least
 * one include pattern and no exclude (`!`-prefixed) pattern. Patterns
 * that resolve outside the project root are warned about and ignored.
 */
export const matchWorkspaceInputFiles = ({
  workspaceName,
  workspacePath,
  inputFilePatterns,
  projectFilePaths,
}: MatchWorkspaceInputFilesOptions): InputFileMatch[] => {
  const { includes, excludes } = splitFilePatterns(inputFilePatterns);

  const resolvedIncludes = resolveFilePatterns({
    workspaceName,
    workspacePath,
    patterns: includes,
    isExclude: false,
  });
  const resolvedExcludes = resolveFilePatterns({
    workspaceName,
    workspacePath,
    patterns: excludes,
    isExclude: true,
  });

  const matchedFiles: InputFileMatch[] = [];
  const matchedFilePaths = new Set<string>();

  for (const filePath of projectFilePaths) {
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
      inputPattern: matchingInclude.inputPattern,
    });
    matchedFilePaths.add(filePath);
  }

  return matchedFiles;
};
