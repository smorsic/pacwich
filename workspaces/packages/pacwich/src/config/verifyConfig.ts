import type {
  ResolvedVerifyConfig,
  VerifyConfig,
} from "@pacwich/common/config";
import { concatUniqueStringArrays } from "../internal/core";

/** Shared by project- and workspace-level `verify` config, which use the identical shape. */
export const resolveVerifyConfig = (
  config: VerifyConfig | undefined,
): ResolvedVerifyConfig => ({
  workspaceDependencies: {
    ignoreInputFiles: config?.workspaceDependencies?.ignoreInputFiles ?? [],
    ignoreImportsFromWorkspacePatterns:
      config?.workspaceDependencies?.ignoreImportsFromWorkspacePatterns ?? [],
  },
});

/**
 * Merge `verify.workspaceDependencies` across configs, concatenating and
 * deduplicating both array fields. Returns `undefined` when neither side
 * contributes any verify config so the merged result omits the key
 * entirely.
 */
export const mergeVerifyConfig = (
  base: VerifyConfig | undefined,
  override: VerifyConfig | undefined,
): VerifyConfig | undefined => {
  if (!base && !override) return undefined;
  if (!base?.workspaceDependencies && !override?.workspaceDependencies) {
    return {};
  }
  const ignoreInputFiles = concatUniqueStringArrays(
    base?.workspaceDependencies?.ignoreInputFiles,
    override?.workspaceDependencies?.ignoreInputFiles,
  );
  const ignoreImportsFromWorkspacePatterns = concatUniqueStringArrays(
    base?.workspaceDependencies?.ignoreImportsFromWorkspacePatterns,
    override?.workspaceDependencies?.ignoreImportsFromWorkspacePatterns,
  );
  return {
    workspaceDependencies: {
      ...(ignoreInputFiles && { ignoreInputFiles }),
      ...(ignoreImportsFromWorkspacePatterns && {
        ignoreImportsFromWorkspacePatterns,
      }),
    },
  };
};
