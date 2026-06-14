import {
  PROJECT_CONFIG_FILE_NAME,
  PROJECT_CONFIG_PACKAGE_JSON_KEY,
  type ProjectConfig,
} from "@pacwich/common/config";
import { loadConfig, type LoadConfigOptions } from "../util/loadConfig";
import {
  createDefaultProjectConfig,
  resolveProjectConfig,
} from "./projectConfig";

export const loadProjectConfig = (
  rootDirectory: string,
  loadOptions: LoadConfigOptions = {},
) => {
  const config = loadConfig(
    "project",
    rootDirectory,
    PROJECT_CONFIG_FILE_NAME,
    PROJECT_CONFIG_PACKAGE_JSON_KEY,
    (content) => resolveProjectConfig(content as ProjectConfig),
    loadOptions,
  );
  return config ?? createDefaultProjectConfig();
};
