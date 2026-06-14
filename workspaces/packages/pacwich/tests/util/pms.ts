/**
 * Registry of package-manager pms that pacwich tests run against,
 * plus capability descriptors used by the pm-matrix helpers in
 * {@link ./testFramework.ts}.
 *
 * New pms are added here once their adapter is wired in
 * `src/packageManager/adapter/registry.ts`. Capability flags let tests
 * opt into the matrix only for pms that support a feature (catalogs,
 * workspace-protocol refs, etc.) instead of name-checking the PM.
 */

import type { PackageManagerName } from "../../src";

export type PmCapabilities = {
  /** Supports `catalog:` references in `package.json` (bun-style catalogs) */
  catalogs: boolean;
  /** Supports `workspace:` protocol version specifiers */
  workspaceProtocol: boolean;
  /**
   * Whether the pm's STATIC `isDependencyVersionWorkspaceFallback` heuristic (the
   * no-lockfile fallback) links a dep when the dep name matches a
   * workspace AND its version range satisfies the workspace's
   * `package.json` version (or the range is `"*"`). True for bun and
   * npm; FALSE for pnpm, whose static fallback matches only the
   * `workspace:` protocol prefix (it doesn't read
   * `linkWorkspacePackages`). Note this gates the static layer only —
   * when a lockfile is present, the lockfile resolver classifies links
   * authoritatively for every pm regardless of this flag.
   */
  semverWorkspaceMatch: boolean;
  /**
   * Encodes divergent per-workspace dep resolutions under a
   * namespaced lockfile key (bun uses `<workspaceName>/<depName>`
   * when a workspace's range can't dedupe with the hoisted version).
   * npm hoists everything to top-level `node_modules/` and has no
   * per-workspace namespacing in its lockfile.
   */
  namespacedLockVersions: boolean;
};

export type RegisteredPm = {
  readonly id: PackageManagerName;
  readonly capabilities: PmCapabilities;
};

export const REGISTERED_PMS = [
  {
    id: "bun",
    capabilities: {
      catalogs: true,
      workspaceProtocol: true,
      semverWorkspaceMatch: true,
      namespacedLockVersions: true,
    },
  },
  {
    id: "pnpm",
    capabilities: {
      // pnpm-workspace.yaml supports both `catalog` (default) and
      // `catalogs` (named), same model as bun.
      catalogs: true,
      // pnpm honors the `workspace:` protocol natively. In fact, on
      // pnpm v10+ defaults (linkWorkspacePackages: false), `workspace:`
      // is the only form that links a dep to a local workspace —
      // vanilla semver ranges go to the registry.
      workspaceProtocol: true,
      // pnpm's static fallback heuristic matches only the `workspace:`
      // prefix — a vanilla semver range does NOT link there, since
      // pacwich doesn't read `linkWorkspacePackages`. Semver-linked
      // deps (under `linkWorkspacePackages: true`) are instead caught
      // by the lockfile resolver once the project is installed.
      semverWorkspaceMatch: false,
      // pnpm's content-addressed `node_modules/.pnpm/` store keeps a
      // single resolved entry per name@version globally. Peer-dep
      // suffixes are stripped by the parser, so workspace lookup
      // falls back to the bare entry like npm.
      namespacedLockVersions: false,
    },
  },
  {
    id: "npm",
    capabilities: {
      // npm has no `catalog:` reference concept.
      catalogs: false,
      // npm 11.x rejects `workspace:`-prefixed deps at install time
      // with EUNSUPPORTEDPROTOCOL. The new isDependencyVersionWorkspaceFallback
      // hook mirrors that by returning false for the prefix on the
      // npm side, so capability-gated tests targeting the prefix
      // skip cleanly.
      workspaceProtocol: false,
      // npm DOES link a dep to a local workspace when the name
      // matches and the range satisfies the workspace's version
      // (or the range is `"*"`).
      semverWorkspaceMatch: true,
      // npm hoists; resolveWorkspaceDepVersion ignores the
      // workspaceName argument and always reads the bare-key entry.
      namespacedLockVersions: false,
    },
  },
] as const satisfies readonly RegisteredPm[];

export type PmId = (typeof REGISTERED_PMS)[number]["id"];
export type PmCapability = keyof PmCapabilities;

/**
 * Pm used when a fixture loader or test isn't explicitly running
 * under a matrix iteration. Bun stays the default since it's the only
 * shipped pm today.
 */
export const DEFAULT_PM_ID: PmId = "bun";

export type PmFilter = {
  /** Restrict to pms whose capability flags are all truthy. */
  requires?: readonly PmCapability[];
};

/**
 * Pms that should participate in a matrix run, after applying the
 * test's capability filter and the optional `PACWICH_TEST_PM` env-var
 * filter (comma-separated pm ids — intended for dev inner-loop, not
 * CI). Returns an empty array when nothing matches; callers decide how
 * to surface that (typically a skipped describe).
 */
export const getActivePms = (
  filter: PmFilter = {},
): readonly RegisteredPm[] => {
  const envFilterRaw = process.env.PACWICH_TEST_PM;
  const envFilter = envFilterRaw
    ? envFilterRaw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : null;

  return REGISTERED_PMS.filter((pm) => {
    if (envFilter && !envFilter.includes(pm.id)) return false;
    if (filter.requires) {
      for (const capability of filter.requires) {
        if (!pm.capabilities[capability]) return false;
      }
    }
    return true;
  });
};
