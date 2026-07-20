import type {
  CatalogReferenceResolution,
  DescribeMissingWorkspacesHintOptions,
  IsDependencyVersionWorkspaceFallbackOptions,
  PackageManagerAdapter,
  ResolveCatalogReferenceOptions,
} from "../../adapter/adapterTypes";
import { versionMatchesWorkspace } from "../util/versionMatchesWorkspace";
import { discoverWorkspacePaths } from "./discoverWorkspacePaths";
import { loadRootMetadata } from "./loadRootMetadata";
import { bunLockfileAdapter, loadBunWorkspaceLinks } from "./lockfile";
import { BUN_LOCK_ERRORS } from "./lockfile/parseBunLock";
import { createScriptCommand } from "./scriptCommand";

const CATALOG_PREFIX = "catalog:";
const WORKSPACE_PROTOCOL_PREFIX = "workspace:";

/**
 * Static fallback heuristic, used when no bun.lock is present
 * (otherwise {@link loadBunWorkspaceLinks} is authoritative).
 *
 * Bun accepts both its native `workspace:` protocol AND vanilla
 * semver-range matches against a workspace's own version. Verified
 * empirically against bun 1.3.14.
 */
const isDependencyVersionWorkspaceFallback = ({
  rawVersion,
  candidateWorkspace,
}: IsDependencyVersionWorkspaceFallbackOptions): boolean => {
  if (!candidateWorkspace) return false;
  if (rawVersion.startsWith(WORKSPACE_PROTOCOL_PREFIX)) return true;
  return versionMatchesWorkspace({
    rawVersion,
    workspaceVersion: candidateWorkspace.version,
  });
};

/**
 * Bun's catalog reference resolution. The raw version takes one of:
 *   - `catalog:`          → default catalog
 *   - `catalog:<name>`    → named catalog
 *
 * Returns `null` for any other version (i.e. not a catalog ref). When the
 * ref is recognized but the package isn't present in the selected catalog,
 * `version` is the empty string and callers fall back to the raw ref.
 */
const resolveCatalogReference = ({
  packageName,
  rawVersion,
  catalogs,
}: ResolveCatalogReferenceOptions): CatalogReferenceResolution | null => {
  if (!rawVersion.startsWith(CATALOG_PREFIX)) return null;
  const catalogName = rawVersion.slice(CATALOG_PREFIX.length);
  const map = catalogName
    ? catalogs.namedCatalogs[catalogName]
    : catalogs.defaultCatalog;
  return {
    catalog: { name: catalogName },
    version: map?.[packageName] ?? "",
  };
};

/**
 * bun (like npm) declares workspaces under `package.json`'s
 * `"workspaces"` field, either as a flat array or as the catalog-object
 * form. When the field is absent entirely we surface a hint pointing
 * at the remedy. An empty `[]` is a deliberate choice (skip).
 */
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
 * Factory for the Bun backend. No shared mutable state. Called per
 * adapter request from {@link resolvePackageManagerAdapter}.
 */
export const createBunAdapter = (): PackageManagerAdapter => ({
  name: "bun",
  loadRootMetadata,
  discoverWorkspacePaths,
  isDependencyVersionWorkspaceFallback,
  parseLockfileWorkspaceLinks: loadBunWorkspaceLinks,
  resolveCatalogReference,
  lockfile: bunLockfileAdapter,
  createScriptCommand,
  describeMissingWorkspacesHint,
  formatImplicitWorkspaceDepVersion: () => "workspace:*",
  errors: {
    LockfileNotFound: BUN_LOCK_ERRORS.BunLockNotFound,
    MalformedLockfile: BUN_LOCK_ERRORS.MalformedBunLock,
    UnsupportedLockfileVersion: BUN_LOCK_ERRORS.UnsupportedBunLockVersion,
  },
});
