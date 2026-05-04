import type {
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

/** Configuration that applies to a specific package.json script */
export type ScriptConfig = {
  /**
   * The order in which the script should be executed.
   *
   * Scripts with no `order` set will be executed in alphanumerical order
   * of their relative path from the project root.
   */
  order?: number;
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
};

export type ResolvedWorkspaceConfig = {
  aliases: string[];
  tags: string[];
  scripts: Record<string, ScriptConfig>;
  rules: WorkspaceRules;
};

/** Static workspace context passed to a {@link WorkspacePatternConfigFactory}.
 * Contains only the immutable, package.json-derived fields — not config-derived fields like aliases or tags. */
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

/** A single entry in {@link RootConfig.workspacePatternConfigs} */
export type WorkspacePatternConfigEntry = {
  /** Workspace patterns to match. Supports all workspace pattern specifiers (name, alias, tag, path, not:). */
  patterns: string[];
  /** Config to merge into all matching workspaces. May be a factory receiving the workspace context and accumulated config. */
  config: WorkspaceConfig | WorkspacePatternConfigFactory;
};

export type RootConfig = {
  defaults?: {
    /** The maximum number of scripts that can run in parallel. (default: "auto") */
    parallelMax?: ParallelMaxValue;
    /** The shell to use for inline scripts. (default: "bun") */
    shell?: ShellOption;
    /** Whether to include the root workspace in the workspaces list by default. (default: false) */
    includeRootWorkspace?: boolean;
    /** The default base ref for affected workspace resolution. (default: "main") */
    affectedBaseRef?: string;
  };
  /**
   * Workspace configs applied by pattern, in order, merging left to right,
   * using any workspaces' local configs as the starting config.
   * Each entry's config is merged into all workspaces matching its patterns.
   * Pattern matching reflects accumulated aliases and tags from previous entries.
   * Factory functions are only supported in TypeScript/JavaScript config files.
   */
  workspacePatternConfigs?: WorkspacePatternConfigEntry[];
};

export type ResolvedRootConfig = {
  defaults: {
    parallelMax: number;
    shell: ScriptShellOption;
    /** `undefined` means the value was not set in the input config */
    includeRootWorkspace: boolean | undefined;
    affectedBaseRef: string;
  };
  workspacePatternConfigs: WorkspacePatternConfigEntry[];
};
