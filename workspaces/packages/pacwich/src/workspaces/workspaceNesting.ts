import { stripTrailingSlashes, toPosixPath } from "../internal/core";
import type { Workspace } from "./workspace";

/**
 * Normalize project-relative path: POSIX-normalize, strip trailing slashes, and map `"."` to `""`
 */
export const normalizeWorkspacePath = (workspacePath: string): string => {
  const posixPath = stripTrailingSlashes(toPosixPath(workspacePath));
  return posixPath === "." ? "" : posixPath;
};

/**
 * Whether `ancestorPath` is a strict directory-ancestor of
 * `descendantPath` (both already normalized via
 * {@link normalizeWorkspacePath}). The root workspace's path (`""`) is an
 * ancestor of every non-root path.
 *
 * @example
 * isAncestorWorkspacePath("packages/a", "packages/a/nested/b"); // true
 * isAncestorWorkspacePath("", "packages/a"); // true (root)
 * isAncestorWorkspacePath("packages/a", "packages/b"); // false (siblings)
 */
export const isAncestorWorkspacePath = (
  ancestorPath: string,
  descendantPath: string,
): boolean => {
  if (!descendantPath || descendantPath === ancestorPath) return false;
  return !ancestorPath || descendantPath.startsWith(`${ancestorPath}/`);
};

/**
 * Paths of other workspaces located inside the given workspace's
 * directory.
 */
export const listNestedWorkspacePaths = ({
  workspacePath,
  otherWorkspacePaths,
}: {
  workspacePath: string;
  otherWorkspacePaths: string[];
}): string[] => {
  const normalizedParent = normalizeWorkspacePath(workspacePath);
  const nestedPaths: string[] = [];
  for (const otherPath of otherWorkspacePaths) {
    const normalizedOther = normalizeWorkspacePath(otherPath);
    if (isAncestorWorkspacePath(normalizedParent, normalizedOther)) {
      nestedPaths.push(normalizedOther);
    }
  }
  return nestedPaths;
};

/**
 * Workspaces whose directory is a literal filesystem ancestor of
 * the given workspace's directory (e.g. an outer workspace that a nested
 * workspace lives inside of) excluding the root workspace.
 *
 * @example
 * findAncestorWorkspaces({ workspace: child, allWorkspaces: project.workspaces });
 */
export const findAncestorWorkspaces = ({
  workspace,
  allWorkspaces,
}: {
  workspace: Workspace;
  allWorkspaces: Workspace[];
}): Workspace[] => {
  const normalizedTarget = normalizeWorkspacePath(workspace.path);
  return allWorkspaces.filter((candidate) => {
    if (candidate.isRoot) return false;
    const normalizedCandidate = normalizeWorkspacePath(candidate.path);
    return isAncestorWorkspacePath(normalizedCandidate, normalizedTarget);
  });
};
