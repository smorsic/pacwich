import type {
  ProjectConfig,
  ResolvedProjectConfig,
} from "@pacwich/common/config";
import type { ProjectConfigFactory, ProjectConfigInput } from "./projectConfig";
import { defineProjectConfig } from "./projectConfig/defineProjectConfig";
import { mergeProjectConfig } from "./projectConfig/mergeProjectConfig";

/**
 * @deprecated Renamed from bun-workspaces: use `ProjectConfig` instead
 */
export type RootConfig = ProjectConfig;
/**
 * @deprecated Renamed from bun-workspaces: use `ResolvedProjectConfig` instead
 */
export type ResolvedRootConfig = ResolvedProjectConfig;
/**
 * @deprecated Renamed from bun-workspaces: use `ProjectConfigFactory` instead
 */
export type RootConfigFactory = ProjectConfigFactory;
/**
 * @deprecated Renamed from bun-workspaces: use `ProjectConfigInput` instead
 */
export type RootConfigInput = ProjectConfigInput;

/**
 * @deprecated Renamed from bun-workspaces: use `defineProjectConfig` instead
 */
export const defineRootConfig = defineProjectConfig;

/**
 * @deprecated Renamed from bun-workspaces: use `mergeProjectConfig` instead
 */
export const mergeRootConfig = mergeProjectConfig;
