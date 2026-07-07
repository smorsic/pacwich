import type {
  OutputStyleName,
  PackageManagerValue,
  ParallelMaxValue,
  ScriptShellOption,
  ShellOption,
} from "../parameters";

export type WorkspaceDependenciesRule = {
  /**
   * Workspace patterns that are permitted as dependencies.
   * Only workspaces matching these patterns are allowed.
   * When combined with `denyPatterns`, the deny list further
   * filters this allowed subset.
   */
  allowPatterns?: string[];
  /**
   * Workspace patterns that are forbidden as dependencies.
   * When combined with `allowPatterns`, this further filters
   * the subset of allowed workspaces.
   */
  denyPatterns?: string[];
};

export type WorkspaceRules = {
  workspaceDependencies?: WorkspaceDependenciesRule;
};

/**
 * Configured inputs for a script.
 *
 * These can be used to specify the files and workspace patterns
 * that should be considered inputs for the script.
 *
 * The default inputs when not provided are all git-trackable files in the workspace.
 */
export type WorkspaceInputsConfig = {
  /**
   * File paths, directory paths, or globs relative to the workspace's path.
   *
   * Prefix with `!` to exclude.
   *
   * The default inputs when not provided are all git-trackable files in the workspace.
   *
   * Files that are not git-trackable are not considered inputs.
   *
   * Paths with a leading `/` are relative to the project root.
   */
  files?: string[];
  /**
   * Matched workspaces are treated as inputs for the script.
   *
   * For example, when workspaces are provided here, they will
   * be treated like dependencies in the affected workspace resolution.
   */
  workspacePatterns?: string[];
  /**
   * Filters which of the workspace's declared external (non-workspace) deps
   * participate in lockfile-change detection.
   *
   * - When omitted, every declared external dep participates (default).
   * - When set to an empty array, no external deps participate (the workspace
   *   will not be flagged from a lockfile change unless something else makes it so).
   * - When set to a non-empty list of package names, only the listed names
   *   participate. Names not present in the workspace's actual
   *   `externalDependencies` are silently ignored.
   */
  externalDependencies?: string[];
};

/** Configuration that applies to a specific package.json script */
export type ScriptConfig = {
  /**
   * The order in which the script should be executed.
   *
   * Scripts with no `order` set will be executed in alphanumerical order
   * of their relative path from the project root.
   */
  order?: number;

  /**
   * Inputs for the script.
   *
   * These can be used to specify the files and workspace patterns
   * that should be considered inputs for the script.
   *
   * The default inputs when not provided are all git-trackable files in the workspace.
   */
  inputs?: WorkspaceInputsConfig;
};

/** Configuration that applies to a specific workspace */
export type WorkspaceConfig = {
  /**
   * An alias or list of aliases for the workspace.
   *
   * These must be unique to other workspaces' aliases
   * and package.json names.
   */
  alias?: string | string[];
  /**
   * Tags for the workspace.
   *
   * These can be used to group workspaces by a common tag.
   */
  tags?: string[];
  /**
   * Configuration that maps to a script name in the workspace's package.json.
   */
  scripts?: Record<string, ScriptConfig>;
  /**
   * Rules that validate the workspace.
   */
  rules?: WorkspaceRules;
  /**
   * The default inputs for the workspace
   * applied to all scripts that don't configure their own inputs.
   */
  defaultInputs?: WorkspaceInputsConfig;
};

export type ResolvedWorkspaceConfig = {
  aliases: string[];
  tags: string[];
  scripts: Record<string, ScriptConfig>;
  rules: WorkspaceRules;
  defaultInputs?: WorkspaceInputsConfig;
};

/** Static workspace context passed to a {@link WorkspacePatternConfigFactory}.
 * Contains only the immutable, package.json-derived fields, not config-derived fields like aliases or tags. */
export type RawWorkspace = {
  name: string;
  isRoot: boolean;
  path: string;
  matchPattern: string;
  scripts: string[];
  dependencies: string[];
  dependents: string[];
};

/** A factory that returns a {@link WorkspaceConfig} to merge for a matched workspace.
 * Receives the static workspace context and the workspace's accumulated resolved config at that point. */
export type WorkspacePatternConfigFactory = (
  workspace: RawWorkspace,
  prevConfig: ResolvedWorkspaceConfig,
) => WorkspaceConfig;

/** A single entry in {@link ProjectConfig.workspacePatternConfigs} */
export type WorkspacePatternConfigEntry = {
  /** Workspace patterns to match. Supports all workspace pattern specifiers (name, alias, tag, path, not:). */
  patterns: string[];
  /** Config to merge into all matching workspaces. May be a factory receiving the workspace context and accumulated config. */
  config: WorkspaceConfig | WorkspacePatternConfigFactory;
};

export type ProjectConfig = {
  /**
   * Package manager backend to use for this project. Accepts
   * `"auto"` (default) for lockfile-driven detection or any
   * concrete `PackageManagerName` (`"bun"`, `"npm"`).
   *
   * Lives at the top level rather than under `defaults` because it
   * defines the project's identity (which lockfile, which workspace
   * dep semantics) rather than a per-invocation preference like the
   * other `defaults.*` fields.
   *
   * Overridden in precedence by (highest first): the
   * `packageManager` option passed to a project factory, the CLI
   * `--pm` flag, this field, the `PACWICH_PACKAGE_MANAGER` env
   * var, then `"auto"`.
   */
  packageManager?: PackageManagerValue;
  defaults?: {
    /** The maximum number of scripts that can run in parallel. (default: "auto") */
    parallelMax?: ParallelMaxValue;
    /** The shell to use for inline scripts. (default: "system") */
    shell?: ShellOption;
    /** Whether to include the root workspace in the workspaces list by default. (default: false) */
    includeRootWorkspace?: boolean;
    /** The default base ref for affected workspace resolution. (default: "main") */
    affectedBaseRef?: string;
    /**
     * Default output style for `run-script` / `run-affected` invocations
     * that don't pass `--output-style`. CLI-only, ignored by API
     * callers (the API does not select an output style). When unset,
     * the CLI falls back to `"grouped"` on a TTY and `"prefixed"`
     * otherwise. A configured `"grouped"` is still downgraded to
     * `"prefixed"` when stdout is not a TTY.
     */
    cliScriptOutputStyle?: OutputStyleName;
    /**
     * Maximum bytes of unconsumed script output to retain in memory per
     * stream (stdout/stderr), per script, when running scripts. Guards
     * against a runaway script's output exhausting memory: once exceeded,
     * the oldest buffered output is dropped (keeping the most recent) and a
     * truncation notice is surfaced. Accepts a byte count, a human size (e.g.
     * `"16MB"`), or `"unbounded"` to disable the cap. (default: 16 MiB)
     */
    maxOutputBufferBytes?: number | "unbounded" | (string & {});
  };
  /**
   * Workspace configs applied by pattern, in order, merging left to right,
   * using any workspaces' local configs as the starting config.
   * Each entry's config is merged into all workspaces matching its patterns.
   * Pattern matching reflects accumulated aliases and tags from previous entries.
   * Factory functions are only supported in TypeScript/JavaScript config files.
   */
  workspacePatternConfigs?: WorkspacePatternConfigEntry[];
  /**
   * Options for the `verify` command and its underlying API.
   */
  verify?: ProjectVerifyConfig;
};

/**
 * Project-level configuration for `pacwich verify` and `project.verify()`.
 *
 * Lives at the project level rather than per-workspace so users have a
 * single visible escape hatch for implicit workspace dependency findings.
 * Per-workspace toggles add config-resolution complexity that wouldn't
 * carry its weight here. If a more targeted exception is needed users
 * can scope `verify` to specific workspaces via its CLI positional
 * workspace patterns.
 */
export type ProjectVerifyConfig = {
  /**
   * Verification rules concerning workspace-to-workspace dependencies.
   * Currently controls implicit-workspace-dependency detection.
   */
  workspaceDependencies?: ProjectVerifyWorkspaceDependenciesConfig;
};

export type ProjectVerifyWorkspaceDependenciesConfig = {
  /**
   * Project-relative globs to skip when scanning workspace source files
   * for implicit workspace dependencies. A leading `/` is accepted and
   * treated the same as no leading slash (both are project-relative).
   * Negation prefixes (`!`) are not honored. This is an exception list,
   * not an inputs list.
   *
   * @example ["scripts/codegen/**\/*", "legacy/**\/*.ts"]
   */
  ignoreInputFiles?: string[];
};

export type ResolvedProjectConfig = {
  /**
   * Always present. `"auto"` when the user did not set
   * `packageManager` in config or the `PACWICH_PACKAGE_MANAGER` env
   * var. Higher-precedence sources (CLI flag, project factory
   * option) are applied downstream of `resolveProjectConfig`.
   */
  packageManager: PackageManagerValue;
  defaults: {
    parallelMax: number;
    shell: ScriptShellOption;
    /** `undefined` means the value was not set in the input config */
    includeRootWorkspace: boolean | undefined;
    affectedBaseRef: string;
    /**
     * `undefined` means neither the config nor the env var set a
     * value, so the CLI should derive a default from terminal state.
     */
    cliScriptOutputStyle: OutputStyleName | undefined;
    /**
     * Resolved per-stream output buffer cap in bytes. `Infinity` means the
     * buffer is unbounded (the user opted out of the cap).
     */
    maxOutputBufferBytes: number;
  };
  workspacePatternConfigs: WorkspacePatternConfigEntry[];
  verify: ResolvedProjectVerifyConfig;
};

export type ResolvedProjectVerifyConfig = {
  workspaceDependencies: ResolvedProjectVerifyWorkspaceDependenciesConfig;
};

export type ResolvedProjectVerifyWorkspaceDependenciesConfig = {
  /**
   * Always present. Defaults to `[]` when not configured.
   */
  ignoreInputFiles: string[];
};
