import type {
  DescribeMissingWorkspacesHintOptions,
  IsDependencyVersionWorkspaceFallbackOptions,
  PackageManagerAdapter,
} from "../../adapter/adapterTypes";
import { versionMatchesWorkspace } from "../util/versionMatchesWorkspace";
import { discoverWorkspacePaths } from "./discoverWorkspacePaths";
import { NPM_ERRORS } from "./errors";
import { loadRootMetadata } from "./loadRootMetadata";
import { loadNpmWorkspaceLinks, npmLockfileAdapter } from "./lockfile";
import { createScriptCommand } from "./scriptCommand";

/**
 * Static fallback heuristic, used when no package-lock.json is present
 * (otherwise {@link loadNpmWorkspaceLinks} is authoritative).
 *
 * npm resolves a dep to a local workspace only when the dep name
 * matches a workspace AND the range is satisfied by the workspace's
 * own version (or the range is `"*"`). npm does NOT accept the
 * `workspace:` protocol prefix. It surfaces `EUNSUPPORTEDPROTOCOL`
 * at install time. pacwich mirrors that: a `workspace:`-prefixed
 * range on an npm-managed project is NOT a workspace dep here
 * either, since the install would break.
 */
const isDependencyVersionWorkspaceFallback = ({
  rawVersion,
  candidateWorkspace,
}: IsDependencyVersionWorkspaceFallbackOptions): boolean => {
  if (!candidateWorkspace) return false;
  return versionMatchesWorkspace({
    rawVersion,
    workspaceVersion: candidateWorkspace.version,
  });
};

const describeMissingWorkspacesHint = ({
  rootPackageJson,
}: DescribeMissingWorkspacesHintOptions): string | null => {
  if (rootPackageJson.workspaces !== undefined) return null;
  return (
    `No workspaces declared. Add a "workspaces" field to the root package.json ` +
    `(e.g. \`"workspaces": ["packages/*"]\`) to enable workspace management.`
  );
};

/**
 * Factory for the npm backend. No shared mutable state.
 *
 * `resolveCatalogReference` always returns null. npm has no
 * catalog concept (the `catalogs` capability flag is false in the
 * test registry).
 */
export const createNpmAdapter = (): PackageManagerAdapter => ({
  name: "npm",
  loadRootMetadata,
  discoverWorkspacePaths,
  isDependencyVersionWorkspaceFallback,
  parseLockfileWorkspaceLinks: loadNpmWorkspaceLinks,
  resolveCatalogReference: () => null,
  lockfile: npmLockfileAdapter,
  createScriptCommand,
  describeMissingWorkspacesHint,
  formatImplicitWorkspaceDepVersion: () => "*",
  errors: {
    LockfileNotFound: NPM_ERRORS.NpmLockNotFound,
    MalformedLockfile: NPM_ERRORS.MalformedNpmLock,
    UnsupportedLockfileVersion: NPM_ERRORS.UnsupportedNpmLockVersion,
  },
});
