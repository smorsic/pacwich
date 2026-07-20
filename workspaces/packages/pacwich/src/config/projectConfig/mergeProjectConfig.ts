import type { ProjectConfig } from "@pacwich/common/config";
import { mergeVerifyConfig } from "../verifyConfig";

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
 * Merge two or more project configs left to right, with each
 * subsequent config taking precedence on scalar fields.
 * `workspacePatternConfigs` entries are concatenated.
 * `verify.workspaceDependencies` array fields (`ignoreInputFiles`,
 * `ignoreImportsFromWorkspacePatterns`) are concatenated and
 * deduplicated. Any argument may be a
 * {@link ProjectConfigFactory} receiving the accumulated config up to
 * that point.
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
