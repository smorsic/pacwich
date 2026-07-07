import type {
  DependencyPatternRule,
  DependencySource,
  WorkspaceConfig,
  WorkspaceDependenciesRule,
  WorkspaceInputsConfig,
  WorkspaceRules,
} from "@pacwich/common/config";
import { resolveOptionalArray } from "../../internal/core";

/**
 * Lazy form of a {@link WorkspaceConfig} that receives the
 * left-merged-so-far config and returns the next config to merge in.
 * Use when a later config needs to read fields contributed by an
 * earlier config.
 *
 * @example
 * const factory: WorkspaceConfigFactory = (prev) => ({
 *   tags: prev.tags?.includes("lib") ? ["lib", "shared"] : ["shared"],
 * });
 */
export type WorkspaceConfigFactory = (prev: WorkspaceConfig) => WorkspaceConfig;

/** Accepted argument shape for {@link mergeWorkspaceConfig}: either a
 * plain {@link WorkspaceConfig} or a {@link WorkspaceConfigFactory}. */
export type WorkspaceConfigInput = WorkspaceConfig | WorkspaceConfigFactory;

const uniqueArray = <T>(arr: T[]): T[] => [...new Set(arr)];

const concatPatterns = (
  a: string[] | undefined,
  b: string[] | undefined,
): string[] | undefined => {
  if (!a?.length && !b?.length) return undefined;
  return uniqueArray([...(a ?? []), ...(b ?? [])]);
};

const mergeDependencyPatternRule = (
  base: DependencyPatternRule | undefined,
  override: DependencyPatternRule | undefined,
): DependencyPatternRule | undefined => {
  const allowPatterns = concatPatterns(
    base?.allowPatterns,
    override?.allowPatterns,
  );
  const denyPatterns = concatPatterns(
    base?.denyPatterns,
    override?.denyPatterns,
  );
  if (!allowPatterns && !denyPatterns) return undefined;
  return {
    ...(allowPatterns && { allowPatterns }),
    ...(denyPatterns && { denyPatterns }),
  };
};

type BySourceRules = NonNullable<WorkspaceDependenciesRule["bySource"]>;

const mergeBySourceRules = (
  base: BySourceRules | undefined,
  override: BySourceRules | undefined,
): BySourceRules | undefined => {
  if (!base && !override) return undefined;
  const sources = uniqueArray([
    ...Object.keys(base ?? {}),
    ...Object.keys(override ?? {}),
  ]) as DependencySource[];
  const merged: BySourceRules = {};
  for (const source of sources) {
    const rule = mergeDependencyPatternRule(base?.[source], override?.[source]);
    if (rule) merged[source] = rule;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
};

const mergeWorkspaceDependenciesRule = (
  base: WorkspaceDependenciesRule | undefined,
  override: WorkspaceDependenciesRule | undefined,
): WorkspaceDependenciesRule | undefined => {
  if (!base && !override) return undefined;
  // The top-level allow/deny patterns share their merge with each per-source
  // entry: `WorkspaceDependenciesRule` structurally extends `DependencyPatternRule`.
  const topLevel = mergeDependencyPatternRule(base, override);
  const bySource = mergeBySourceRules(base?.bySource, override?.bySource);
  if (!topLevel && !bySource) return {};
  return {
    ...topLevel,
    ...(bySource && { bySource }),
  };
};

const mergeWorkspaceRules = (
  base: WorkspaceRules | undefined,
  override: WorkspaceRules | undefined,
): WorkspaceRules => {
  const workspaceDependencies = mergeWorkspaceDependenciesRule(
    base?.workspaceDependencies,
    override?.workspaceDependencies,
  );
  return {
    ...(workspaceDependencies && { workspaceDependencies }),
  };
};

const mergeScripts = (
  base: WorkspaceConfig["scripts"],
  override: WorkspaceConfig["scripts"],
): WorkspaceConfig["scripts"] => {
  if (!base && !override) return {};
  if (!base) return override ?? {};
  if (!override) return base;

  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = base[key] ? { ...base[key], ...value } : value;
  }
  return merged;
};

const mergeDefaultInputs = (
  base: WorkspaceInputsConfig | undefined,
  override: WorkspaceInputsConfig | undefined,
): WorkspaceInputsConfig | undefined => override ?? base;

const applyConfig = (
  acc: WorkspaceConfig,
  config: WorkspaceConfig,
): WorkspaceConfig => {
  const defaultInputs = mergeDefaultInputs(
    acc.defaultInputs,
    config.defaultInputs,
  );
  return {
    alias: uniqueArray([
      ...resolveOptionalArray(acc.alias ?? []),
      ...resolveOptionalArray(config.alias ?? []),
    ]),
    tags: uniqueArray([...(acc.tags ?? []), ...(config.tags ?? [])]),
    scripts: mergeScripts(acc.scripts, config.scripts),
    rules: mergeWorkspaceRules(acc.rules, config.rules),
    ...(defaultInputs && { defaultInputs }),
  };
};

/**
 * Merge two or more workspace configs left to right, with each
 * subsequent config taking precedence. Objects are deeply merged,
 * and arrays (`alias`, `tags`, `allowPatterns`, `denyPatterns`,
 * including per-field `rules.workspaceDependencies.bySource` entries) are
 * concatenated and deduplicated. Inputs (`defaultInputs` and script
 * `inputs`) are replaced wholesale rather than merged, since input
 * patterns are an exhaustive list. Any argument may be a
 * {@link WorkspaceConfigFactory} receiving the accumulated config
 * up to that point.
 *
 * @example
 * // pacwich.workspace.ts
 * import { mergeWorkspaceConfig } from "pacwich/config";
 *
 * export default mergeWorkspaceConfig(
 *   { alias: "a", tags: ["x"] },
 *   { alias: "b", scripts: { build: { order: 1 } } },
 *   (prev) => ({ tags: ["y"] }),
 * );
 * // -> { alias: ["a", "b"], tags: ["x", "y"], scripts: { build: { order: 1 } } }
 */
export const mergeWorkspaceConfig = (
  ...configs: WorkspaceConfigInput[]
): WorkspaceConfig =>
  configs.reduce<WorkspaceConfig>((acc, configOrFactory) => {
    const config =
      typeof configOrFactory === "function"
        ? configOrFactory(acc)
        : configOrFactory;
    return applyConfig(acc, config);
  }, {});
