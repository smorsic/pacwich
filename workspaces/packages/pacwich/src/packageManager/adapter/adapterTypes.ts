import type { PackageManagerName } from "@pacwich/common/parameters";
import type { PacwichError } from "../../internal/core";
import type {
  ExternalDependencyCatalog,
  Workspace,
} from "../../workspaces/workspace";

/**
 * Abstract error classes every backend must expose via
 * {@link PackageManagerAdapter.errors}. The concrete classes a backend
 * surfaces here may carry PM-specific messages and naming (for example,
 * bun's `BunLockNotFound` maps to `LockfileNotFound`), but tests that
 * assert against the contract use the abstract names so they hold
 * regardless of which backend is active.
 */
export type PackageManagerAdapterErrors = {
  /** Lockfile required but not found at the project root */
  LockfileNotFound: typeof PacwichError;
  /** Lockfile present but unparseable */
  MalformedLockfile: typeof PacwichError;
  /** Lockfile has an unsupported version */
  UnsupportedLockfileVersion: typeof PacwichError;
};

/**
 * The set of package manager backends pacwich ships. Canonical
 * definition lives in `@pacwich/common/parameters` so the root
 * config and CLI surface can reference it without pulling in the
 * pacwich package. Re-exported here for back-compat with code that
 * imports from `pacwich/packageManager/adapter`.
 *
 * New backends are added in `@pacwich/common/parameters` and to
 * `ADAPTER_FACTORIES` in `./registry.ts`.
 */
export {
  PACKAGE_MANAGER_NAMES,
  PACKAGE_MANAGER_VALUES,
  type PackageManagerName,
  type PackageManagerValue,
} from "@pacwich/common/parameters";

/**
 * A project's catalog data. A catalog maps a package name to a single
 * version string that workspaces can reference (typically via a
 * `catalog:` ref) instead of pinning a version in their `package.json`.
 * Backends without a catalog concept return empty objects.
 *
 * Concretely, for example: bun stores these under
 * `package.json.workspaces.{catalog,catalogs}`.
 */
export type CatalogSet = {
  /** Default catalog (the unnamed one) */
  defaultCatalog: Record<string, string>;
  /** Named catalogs, keyed by catalog name */
  namedCatalogs: Record<string, Record<string, string>>;
};

/**
 * Lockfile-derived map from `<packageName>` (or a backend-specific
 * namespaced form, for per-workspace divergent resolutions) to its
 * resolved version string. Used for external-dependency change detection
 * by the affected feature.
 */
export type LockVersionMap = Map<string, string>;

/**
 * Resolution of a catalog reference. Returned by
 * {@link PackageManagerAdapter.resolveCatalogReference}.
 *
 * `version` is an empty string when the raw version was recognized as a
 * catalog reference but no entry could be resolved (callers typically
 * fall back to the raw reference string in that case).
 */
export type CatalogReferenceResolution = {
  catalog: ExternalDependencyCatalog;
  version: string;
};

/**
 * Options for {@link PackageManagerAdapter.loadRootMetadata}.
 */
export type LoadRootMetadataOptions = {
  rootDirectory: string;
  rootPackageJson: Record<string, unknown>;
};

/**
 * Result of {@link PackageManagerAdapter.loadRootMetadata}.
 */
export type LoadRootMetadataResult = {
  /** Workspace globs declared by the project (e.g. `["packages/*"]`) */
  workspaceGlobs: string[];
  /** Catalogs declared by the project */
  catalogs: CatalogSet;
};

/**
 * Options for {@link PackageManagerAdapter.discoverWorkspacePaths}.
 */
export type DiscoverWorkspacePathsOptions = {
  rootDirectory: string;
  workspaceGlobs: string[];
};

/**
 * Result of {@link PackageManagerAdapter.discoverWorkspacePaths}.
 */
export type DiscoverWorkspacePathsResult = {
  /** Absolute paths to each workspace directory (including the root) */
  absolutePaths: string[];
};

/**
 * Options for {@link PackageManagerAdapter.resolveCatalogReference}.
 */
export type ResolveCatalogReferenceOptions = {
  packageName: string;
  rawVersion: string;
  catalogs: CatalogSet;
};

/**
 * The workspace whose `name` matches the dep being classified by
 * {@link PackageManagerAdapter.isDependencyVersionWorkspaceFallback}. `version` is
 * the workspace's `package.json` version field (undefined when the
 * workspace declares no version). The shape is intentionally narrow:
 * the hook only needs the bits required for semver matching.
 */
export type CandidateWorkspace = {
  name: string;
  version: string | undefined;
};

/**
 * Options for {@link PackageManagerAdapter.isDependencyVersionWorkspaceFallback}.
 */
export type IsDependencyVersionWorkspaceFallbackOptions = {
  /** Dep name from the consuming workspace's `package.json` */
  depName: string;
  /** The raw range string the user wrote (`"*"`, `"^1.0.0"`, `"workspace:*"`, etc.) */
  rawVersion: string;
  /**
   * Workspace candidate matched by `depName`, or `null` if no
   * workspace in the project carries that name.
   */
  candidateWorkspace: CandidateWorkspace | null;
};

/**
 * Verdict for a single (consuming workspace, dependency) pair derived
 * from the project's lockfile by a {@link WorkspaceLinkResolver}.
 *
 * `"link"` and `"external"` are authoritative — they record what the
 * package manager actually did at install time. `"unknown"` means the
 * lockfile doesn't record this pair (a dep added to `package.json` but
 * not yet installed, a stale lockfile, or no lockfile at all); callers
 * then fall back to the static
 * {@link PackageManagerAdapter.isDependencyVersionWorkspaceFallback} heuristic.
 */
export type WorkspaceLinkVerdict = "link" | "external" | "unknown";

/**
 * Options for {@link WorkspaceLinkResolver.classify}.
 */
export type ClassifyWorkspaceLinkOptions = {
  /**
   * Project-relative path of the consuming workspace (matches
   * `Workspace.path`; the empty string for the root workspace).
   */
  workspacePath: string;
  /** Dependency name from the consuming workspace's `package.json`. */
  depName: string;
};

/**
 * Lockfile-derived classifier that answers, authoritatively, whether a
 * given dependency resolved to a local workspace at install time. Built
 * per-project by {@link PackageManagerAdapter.parseLockfileWorkspaceLinks}.
 *
 * Package managers record links differently — pnpm per-importer
 * (`version: link:…`), npm via a hoisted `node_modules/<dep>` entry with
 * `"link": true`, bun via a `<dep>@workspace:<path>` resolution string —
 * but all expose the same query shape here. pms that hoist links
 * globally (bun, npm) return the same verdict for a dep name regardless
 * of `workspacePath`.
 */
export type WorkspaceLinkResolver = {
  classify(options: ClassifyWorkspaceLinkOptions): WorkspaceLinkVerdict;
};

/**
 * Options for {@link PackageManagerAdapter.parseLockfileWorkspaceLinks}.
 */
export type ParseLockfileWorkspaceLinksOptions = {
  rootDirectory: string;
};

/**
 * Options for {@link PackageManagerLockfileAdapter.loadCurrentVersions}.
 */
export type LoadCurrentLockVersionsOptions = {
  rootDirectory: string;
};

/**
 * Options for {@link PackageManagerLockfileAdapter.loadVersionsAtGitRef}.
 */
export type LoadLockVersionsAtGitRefOptions = {
  rootDirectory: string;
  ref: string;
};

/**
 * Options for {@link PackageManagerLockfileAdapter.resolveWorkspaceDepVersion}.
 */
export type ResolveWorkspaceDepVersionOptions = {
  lock: LockVersionMap;
  workspaceName: string;
  depName: string;
};

/**
 * Lockfile capabilities of a package manager. Grouped as a sub-object so
 * the top-level adapter surface stays readable.
 */
export type PackageManagerLockfileAdapter = {
  /**
   * Project-relative path to the lockfile (for example, `"bun.lock"`).
   * Used by fileList-mode synthetic-change detection in the affected
   * feature.
   */
  projectRelativePath: string;
  /**
   * Read and parse the current on-disk lockfile. Returns an empty map if
   * the lockfile is missing or unparseable (warnings are logged by the
   * backend).
   */
  loadCurrentVersions(options: LoadCurrentLockVersionsOptions): LockVersionMap;
  /**
   * Read and parse the lockfile at a given git ref. Returns an empty map
   * if the file does not exist at that ref or could not be parsed.
   */
  loadVersionsAtGitRef(
    options: LoadLockVersionsAtGitRefOptions,
  ): Promise<LockVersionMap>;
  /**
   * Resolve a workspace's external-dep version from the lockfile version
   * map. Some backends encode divergent per-workspace resolutions under
   * a namespaced key (for example, bun uses `<wsName>/<depName>` when a
   * workspace's range can't dedupe with the hoisted version), falling
   * back to the bare `<depName>` for the common hoisted case.
   */
  resolveWorkspaceDepVersion(
    options: ResolveWorkspaceDepVersionOptions,
  ): string | null;
};

/**
 * Options for {@link PackageManagerAdapter.describeMissingWorkspacesHint}.
 */
export type DescribeMissingWorkspacesHintOptions = {
  rootDirectory: string;
  rootPackageJson: Record<string, unknown>;
};

/**
 * Options for {@link PackageManagerAdapter.formatImplicitWorkspaceDepVersion}.
 */
export type FormatImplicitWorkspaceDepVersionOptions = {
  /**
   * The workspace being suggested as an explicit dependency. Backends
   * may consult `version` to pick a more specific range. v1
   * implementations return a static range.
   */
  workspace: Workspace;
};

/** A concrete command to invoke for a workspace's script */
export type ScriptCommand = {
  /** Shell command string */
  command: string;
  /** Directory the command should be executed in */
  workingDirectory: string;
};

/**
 * Options for {@link PackageManagerAdapter.createScriptCommand}.
 */
export type CreateScriptCommandOptions = {
  scriptName: string;
  args: string;
  workspace: Workspace;
  rootDirectory: string;
};

/**
 * Single source of truth for everything package-manager-specific.
 * Produced by a factory. No shared mutable state, no class.
 */
export type PackageManagerAdapter = {
  /** Identifier for diagnostics and serialization */
  name: PackageManagerName;

  /**
   * Read the project's workspace globs and catalog data from wherever the
   * backend stores them (for example, bun reads `package.json.workspaces`,
   * supporting both the flat array form and the catalog-object form).
   */
  loadRootMetadata(options: LoadRootMetadataOptions): LoadRootMetadataResult;

  /**
   * Return absolute paths to each workspace directory (including the
   * root). The backend may consult its lockfile, walk the supplied globs,
   * or use whatever source of truth it owns (for example, bun reads
   * `bun.lock.workspaces`).
   */
  discoverWorkspacePaths(
    options: DiscoverWorkspacePathsOptions,
  ): DiscoverWorkspacePathsResult;

  /**
   * A fallback to plainly check if the package.json version of a dependency
   * looks like a workspace reference. Primary source of truth is the lockfile's
   * linking ({@link parseLockfileWorkspaceLinks}).
   */
  isDependencyVersionWorkspaceFallback(
    options: IsDependencyVersionWorkspaceFallbackOptions,
  ): boolean;

  /**
   * Build a lockfile-derived {@link WorkspaceLinkResolver} for the
   * project, or `null` when no lockfile is present on disk (or it can't
   * be parsed).
   *
   * The resolver is the authoritative source of truth for
   * whether a dependency resolved to a local workspace.
   *
   * Optional: a backend that omits this relies entirely on the static
   * heuristic.
   */
  parseLockfileWorkspaceLinks?(
    options: ParseLockfileWorkspaceLinksOptions,
  ): WorkspaceLinkResolver | null;

  /**
   * Resolve a catalog reference to a concrete version. Returns `null`
   * when the raw version is not a catalog reference. When the reference
   * is recognized but cannot be resolved, `version` is the empty string
   * and callers typically fall back to the raw reference string.
   * Backends without a catalog concept always return `null`.
   */
  resolveCatalogReference(
    options: ResolveCatalogReferenceOptions,
  ): CatalogReferenceResolution | null;

  /** Lockfile-based external dep version tracking (affected detection) */
  lockfile: PackageManagerLockfileAdapter;

  /**
   * Build the command string and working directory for invoking a
   * workspace script. Consumed internally only. The public `Project`
   * interface does not expose this directly.
   */
  createScriptCommand(options: CreateScriptCommandOptions): ScriptCommand;

  /**
   * Abstract error classes this backend exposes. Tests that need to
   * assert "this method throws when the lockfile is missing" target the
   * adapter-level name (`adapter.errors.LockfileNotFound`) rather than
   * the backend-specific concrete class, so the assertion holds across
   * every shipped backend. See {@link PackageManagerAdapterErrors}.
   */
  errors: PackageManagerAdapterErrors;

  /**
   * Optional. Returns a backend-specific hint when the project loaded
   * with no nested workspaces AND the user appears not to have
   * configured any (e.g. no `"workspaces"` field in `package.json` for
   * bun/npm, no `pnpm-workspace.yaml` for pnpm). The caller logs this
   * as a warning so a user who pointed pacwich at the wrong directory,
   * or simply forgot to declare workspaces, sees an actionable hint
   * instead of a silent "0 workspaces" result.
   *
   * Returns `null` when workspace configuration IS present (an empty
   * `"workspaces": []` array, or a `pnpm-workspace.yaml` with no
   * `packages` key). That's a deliberate empty list, not a
   * misconfiguration. Backends without a meaningful hint omit the
   * hook entirely.
   */
  describeMissingWorkspacesHint?: (
    options: DescribeMissingWorkspacesHintOptions,
  ) => string | null;

  /**
   * Format the version string pacwich suggests (and, in a future
   * `--fix` mode, will write) when declaring an implicit workspace
   * dependency in a workspace's `package.json`. The choice mirrors
   * what each pm canonically accepts for local-workspace resolution:
   *   - bun and npm: `"*"` matches the workspace's own version
   *   - pnpm: `"workspace:*"` is the canonical workspace-protocol form
   *
   * Used by the verify command's fix hints. Must return a string
   * suitable for direct insertion as the value of a `dependencies`
   * entry. No surrounding quotes.
   */
  formatImplicitWorkspaceDepVersion(
    options: FormatImplicitWorkspaceDepVersionOptions,
  ): string;
};
