import {
  type WorkspaceConfig,
  type ResolvedWorkspaceConfig,
} from "@pacwich/common/config";
import { resolveWorkspaceConfig } from "./workspaceConfig";

/**
 * Identity-style helper for authoring a `pacwich.workspace.{ts,js}`
 * file. Accepts a {@link WorkspaceConfig} and returns it resolved,
 * normalizing `alias`/`aliases` to the resolved array form.
 *
 * Same effect as exporting the raw object, but gives editors type
 * checking and autocomplete on the config shape without an explicit
 * type annotation.
 *
 * @example
 * // pacwich.workspace.ts
 * import { defineWorkspaceConfig } from "pacwich/config";
 *
 * export default defineWorkspaceConfig({
 *   alias: "core",
 *   tags: ["lib"],
 *   scripts: { build: { order: 1 } },
 * });
 */
export const defineWorkspaceConfig = (
  config: WorkspaceConfig,
): ResolvedWorkspaceConfig => {
  if (Array.isArray((config as ResolvedWorkspaceConfig).aliases)) {
    const { aliases, ...rest } = config as ResolvedWorkspaceConfig;
    return resolveWorkspaceConfig({
      ...rest,
      alias: aliases,
    });
  }
  return resolveWorkspaceConfig(config);
};
