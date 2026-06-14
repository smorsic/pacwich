import type {
  LockVersionMap,
  PackageManagerAdapter,
} from "../packageManager/adapter";
import type { ExternalDependencySource, Workspace } from "../workspaces";

/**
 * A version delta for a single workspace's external dependency between
 * two reference points (typically `baseRef` vs `headRef`).
 *
 * `baseVersion`/`headVersion` are `null` when the dep was absent at that
 * side of the comparison (added or removed). When both are non-null and
 * differ, the version was upgraded/downgraded.
 *
 * All four `package.json` dependency map sources participate. For
 * `optionalDependencies` and `peerDependencies`, lockfile presence is the
 * effective gate. If the package manager didn't resolve a version (e.g.
 * an optional native binding skipped on this platform), no change is
 * emitted.
 */
export type ExternalDependencyChange = {
  /** The package name */
  name: string;
  /** Which `package.json` dependency map this dep was declared in */
  source: ExternalDependencySource;
  /** Version at the base point (`null` if absent) */
  baseVersion: string | null;
  /** Version at the head point (`null` if absent) */
  headVersion: string | null;
};

export type ExternalDependencyChangesByWorkspace = Map<
  string,
  ExternalDependencyChange[]
>;

/**
 * Given each workspace's declared external deps and lockfile version maps
 * at base vs head, emit per-workspace change entries for any external dep
 * whose resolved version differs (including added/removed). The adapter
 * owns the "look up a workspace's dep version in the lockfile map" step,
 * since some backends encode divergent per-workspace resolutions under
 * namespaced keys.
 *
 * Pure function. No I/O.
 */
export const computeExternalDependencyChanges = ({
  workspaces,
  baseLock,
  headLock,
  adapter,
}: {
  workspaces: Workspace[];
  baseLock: LockVersionMap;
  headLock: LockVersionMap;
  adapter: PackageManagerAdapter;
}): ExternalDependencyChangesByWorkspace => {
  const result: ExternalDependencyChangesByWorkspace = new Map();
  for (const workspace of workspaces) {
    const changes: ExternalDependencyChange[] = [];
    for (const { name, source } of workspace.externalDependencies) {
      const baseVersion = adapter.lockfile.resolveWorkspaceDepVersion({
        lock: baseLock,
        workspaceName: workspace.name,
        depName: name,
      });
      const headVersion = adapter.lockfile.resolveWorkspaceDepVersion({
        lock: headLock,
        workspaceName: workspace.name,
        depName: name,
      });
      if (baseVersion === headVersion) continue;
      changes.push({ name, source, baseVersion, headVersion });
    }
    if (changes.length) result.set(workspace.name, changes);
  }
  return result;
};
