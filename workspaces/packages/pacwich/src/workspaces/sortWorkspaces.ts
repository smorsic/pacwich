import type { Workspace } from "./workspace";

/**
 * Stable workspace ordering used by both the assembly pipeline and pattern
 * matching: root workspace first, then by path, with name as a tiebreaker.
 * Duplicates by `path` are collapsed (first wins).
 */
export const sortWorkspaces = (workspaces: Workspace[]) =>
  [...workspaces]
    .sort((a, b) =>
      a.isRoot
        ? -1
        : b.isRoot
          ? 1
          : a.path.localeCompare(b.path) || a.name.localeCompare(b.name),
    )
    .reduce<Workspace[]>((acc, workspace, i, arr) => {
      const previousWorkspace = arr[i - 1];
      if (previousWorkspace && previousWorkspace.path === workspace.path) {
        return acc;
      }
      return [...acc, workspace];
    }, []);
