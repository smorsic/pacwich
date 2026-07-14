import path from "path";
import {
  PROJECT_CONFIG_FILE_NAME,
  PROJECT_CONFIG_PACKAGE_JSON_KEY,
  type ProjectConfig,
  type ResolvedProjectConfig,
} from "@pacwich/common/config";
import {
  createConfigErrorPathPrefix,
  loadConfig,
  type LoadConfigOptions,
} from "../util/loadConfig";
import {
  createDefaultProjectConfig,
  resolveProjectConfig,
} from "./projectConfig";

export type LoadedProjectConfig = {
  config: ResolvedProjectConfig;
  /** Display-ready path of the config source. Undefined when no config
   * file exists and defaults were used. */
  configPath?: string;
};

/** Same as {@link loadProjectConfig} but also reports where the config
 * was loaded from, for error messages that need to name the source. */
export const loadProjectConfigWithPath = (
  rootDirectory: string,
  loadOptions: LoadConfigOptions = {},
): LoadedProjectConfig => {
  const result = loadConfig(
    "project",
    rootDirectory,
    PROJECT_CONFIG_FILE_NAME,
    PROJECT_CONFIG_PACKAGE_JSON_KEY,
    (content, location): LoadedProjectConfig => ({
      config: resolveProjectConfig(content as ProjectConfig),
      configPath: createConfigErrorPathPrefix(path.resolve(location.path)),
    }),
    loadOptions,
  );
  return result ?? { config: createDefaultProjectConfig() };
};

export const loadProjectConfig = (
  rootDirectory: string,
  loadOptions: LoadConfigOptions = {},
) => loadProjectConfigWithPath(rootDirectory, loadOptions).config;
