import fs from "fs";
import path from "path";
import type {
  CatalogReferenceResolution,
  DescribeMissingWorkspacesHintOptions,
  IsDependencyVersionWorkspaceFallbackOptions,
  PackageManagerAdapter,
  ResolveCatalogReferenceOptions,
} from "../../adapter/adapterTypes";
import { discoverWorkspacePaths } from "./discoverWorkspacePaths";
import { PNPM_ERRORS } from "./errors";
import { loadRootMetadata } from "./loadRootMetadata";
import { loadPnpmWorkspaceLinks, pnpmLockfileAdapter } from "./lockfile";
import { PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH } from "./pnpmWorkspaceYaml";
import { createScriptCommand } from "./scriptCommand";

const CATALOG_PREFIX = "catalog:";
const WORKSPACE_PROTOCOL_PREFIX = "workspace:";

/**
 * Static fallback heuristic, used only when no pnpm-lock.yaml is
 * present (otherwise {@link loadPnpmWorkspaceLinks} is authoritative).
 *
 * pnpm always links the `workspace:` protocol prefix. Whether it also
 * links a vanilla semver match depends on `linkWorkspacePackages` (off
 * by default on pnpm 10+, where semver ranges go to the registry; on,
 * they link to the local workspace like npm/bun). pacwich does not read
 * that setting, so without  a lockfile we conservatively match only the
 * protocol prefix and let the lockfile-based resolver pick up semver-linked
 * deps once the project is installed.
 */
const isDependencyVersionWorkspaceFallback = ({
  rawVersion,
  candidateWorkspace,
}: IsDependencyVersionWorkspaceFallbackOptions): boolean => {
  if (!candidateWorkspace) return false;
  return rawVersion.startsWith(WORKSPACE_PROTOCOL_PREFIX);
};

/**
 * pnpm catalog references take the same shape as bun's:
 *   - `catalog:`          → default catalog
 *   - `catalog:<name>`    → named catalog
 * The catalogs themselves live in `pnpm-workspace.yaml` rather than
 * `package.json`, but resolution semantics from a dep's POV are
 * identical.
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
 * pnpm reads workspace globs from `pnpm-workspace.yaml` (NOT from
 * `package.json.workspaces`). When the file is absent we surface a
 * hint pointing at the remedy. A file with no `packages` key (or an
 * empty array) is a deliberate empty config and skips the hint.
 */
const describeMissingWorkspacesHint = ({
  rootDirectory,
}: DescribeMissingWorkspacesHintOptions): string | null => {
  const yamlPath = path.join(
    rootDirectory,
    PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH,
  );
  if (fs.existsSync(yamlPath)) return null;
  return (
    `No workspaces declared. Create a "pnpm-workspace.yaml" file at the project root ` +
    `(e.g. \`packages:\\n  - "packages/*"\`) to enable workspace management.`
  );
};

/** Factory for the pnpm backend. No shared mutable state. */
export const createPnpmAdapter = (): PackageManagerAdapter => ({
  name: "pnpm",
  loadRootMetadata,
  discoverWorkspacePaths,
  isDependencyVersionWorkspaceFallback,
  parseLockfileWorkspaceLinks: loadPnpmWorkspaceLinks,
  resolveCatalogReference,
  lockfile: pnpmLockfileAdapter,
  createScriptCommand,
  describeMissingWorkspacesHint,
  formatImplicitWorkspaceDepVersion: () => "workspace:*",
  errors: {
    LockfileNotFound: PNPM_ERRORS.PnpmLockNotFound,
    MalformedLockfile: PNPM_ERRORS.MalformedPnpmLock,
    UnsupportedLockfileVersion: PNPM_ERRORS.UnsupportedPnpmLockVersion,
  },
});
