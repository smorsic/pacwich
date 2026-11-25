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
    strictDisallowAncestorWorkspaceDeps:
      config?.workspaceDependencies?.strictDisallowAncestorWorkspaceDeps ??
      false,
  },
});

/**
 * Merge `verify.workspaceDependencies` across configs: the two array
 * fields concatenate and deduplicate, `strictDisallowAncestorWorkspaceDeps`
 * is later-wins (only set in the result when either side set it). Returns
 * `undefined` when neither side contributes any verify config so the
 * merged result omits the key entirely.
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
  const strictDisallowAncestorWorkspaceDeps =
    override?.workspaceDependencies?.strictDisallowAncestorWorkspaceDeps ??
    base?.workspaceDependencies?.strictDisallowAncestorWorkspaceDeps;
  return {
    workspaceDependencies: {
      ...(ignoreInputFiles && { ignoreInputFiles }),
      ...(ignoreImportsFromWorkspacePatterns && {
        ignoreImportsFromWorkspacePatterns,
      }),
      ...(strictDisallowAncestorWorkspaceDeps !== undefined && {
        strictDisallowAncestorWorkspaceDeps,
      }),
    },
  };
};
