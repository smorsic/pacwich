import type {
  ProjectConfig,
  ProjectVerifyConfig,
} from "@pacwich/common/config";

/**
 * Lazy form of a {@link ProjectConfig} that receives the
 * left-merged-so-far config and returns the next config to merge in.
 * Use when a later config needs to read fields contributed by an
 * earlier config.
 *
 * @example
 * const factory: ProjectConfigFactory = (prev) => ({
 *   defaults: { parallelMax: prev.defaults?.parallelMax ?? 4 },
 * });
 */
export type ProjectConfigFactory = (prev: ProjectConfig) => ProjectConfig;

/** Accepted argument shape for {@link mergeProjectConfig}: either a plain
 * {@link ProjectConfig} or a {@link ProjectConfigFactory}. */
export type ProjectConfigInput = ProjectConfig | ProjectConfigFactory;

/**
 * Concatenate `verify.workspaceDependencies.ignoreInputFiles` arrays
 * across configs, preserving order and deduplicating exact matches.
 * Returns `undefined` when neither side contributes any verify config
 * so the merged result omits the key entirely.
 */
const mergeVerifyConfig = (
  base: ProjectVerifyConfig | undefined,
  override: ProjectVerifyConfig | undefined,
): ProjectVerifyConfig | undefined => {
  if (!base && !override) return undefined;
  const baseIgnore = base?.workspaceDependencies?.ignoreInputFiles ?? [];
  const overrideIgnore =
    override?.workspaceDependencies?.ignoreInputFiles ?? [];
  if (baseIgnore.length === 0 && overrideIgnore.length === 0) {
    if (!base?.workspaceDependencies && !override?.workspaceDependencies) {
      return {};
    }
    return { workspaceDependencies: {} };
  }
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const pattern of [...baseIgnore, ...overrideIgnore]) {
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    merged.push(pattern);
  }
  return { workspaceDependencies: { ignoreInputFiles: merged } };
};

/**
 * Merge two or more project configs left to right, with each
 * subsequent config taking precedence on scalar fields.
 * `workspacePatternConfigs` entries are concatenated.
 * `verify.workspaceDependencies.ignoreInputFiles` arrays are
 * concatenated and deduplicated. Any argument may be a
 * {@link ProjectConfigFactory} receiving the accumulated config
 * up to that point.
 *
 * @example
 * // pacwich.project.ts
 * import { mergeProjectConfig } from "pacwich/config";
 *
 * export default mergeProjectConfig(
 *   { defaults: { parallelMax: 4 } },
 *   { defaults: { shell: "system" } },
 *   (prev) => ({ defaults: { includeRootWorkspace: true } }),
 * );
 */
export const mergeProjectConfig = (
  ...configs: ProjectConfigInput[]
): ProjectConfig =>
  configs.reduce<ProjectConfig>((acc, configOrFactory) => {
    const config =
      typeof configOrFactory === "function"
        ? configOrFactory(acc)
        : configOrFactory;
    const mergedPatternConfigs = [
      ...(acc.workspacePatternConfigs ?? []),
      ...(config.workspacePatternConfigs ?? []),
    ];
    const mergedVerify = mergeVerifyConfig(acc.verify, config.verify);
    return {
      ...(config.packageManager !== undefined
        ? { packageManager: config.packageManager }
        : acc.packageManager !== undefined
          ? { packageManager: acc.packageManager }
          : {}),
      defaults: {
        ...acc.defaults,
        ...config.defaults,
      },
      ...(mergedPatternConfigs.length > 0 && {
        workspacePatternConfigs: mergedPatternConfigs,
      }),
      ...(mergedVerify !== undefined && { verify: mergedVerify }),
    };
  }, {});
