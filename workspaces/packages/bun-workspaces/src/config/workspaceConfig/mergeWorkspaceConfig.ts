import type {
  WorkspaceConfig,
  WorkspaceDependenciesRule,
  WorkspaceInputsConfig,
  WorkspaceRules,
} from "bw-common/config";
import { resolveOptionalArray } from "../../internal/core";

export type WorkspaceConfigFactory = (prev: WorkspaceConfig) => WorkspaceConfig;

export type WorkspaceConfigInput = WorkspaceConfig | WorkspaceConfigFactory;

const uniqueArray = <T>(arr: T[]): T[] => [...new Set(arr)];

const concatPatterns = (
  a: string[] | undefined,
  b: string[] | undefined,
): string[] | undefined => {
  if (!a?.length && !b?.length) return undefined;
  return uniqueArray([...(a ?? []), ...(b ?? [])]);
};

const mergeWorkspaceDependenciesRule = (
  base: WorkspaceDependenciesRule | undefined,
  override: WorkspaceDependenciesRule | undefined,
): WorkspaceDependenciesRule | undefined => {
  if (!base && !override) return undefined;
  const allowPatterns = concatPatterns(
    base?.allowPatterns,
    override?.allowPatterns,
  );
  const denyPatterns = concatPatterns(
    base?.denyPatterns,
    override?.denyPatterns,
  );
  return {
    ...(allowPatterns && { allowPatterns }),
    ...(denyPatterns && { denyPatterns }),
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
 * Merge two or more workspace configs left to right, with each subsequent config taking precedence.
 * Any argument may be a factory function receiving the accumulated config up to that point.
 *
 * Generally, objects are deeply merged, and arrays are concatenated and deduplicated,
 * **except** for workspace inputs (defaultInputs and script inputs), which are replaced entirely.
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
