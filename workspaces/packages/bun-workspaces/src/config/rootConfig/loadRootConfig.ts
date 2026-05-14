import {
  ROOT_CONFIG_FILE_NAME,
  ROOT_CONFIG_PACKAGE_JSON_KEY,
  type RootConfig,
} from "bw-common/config";
import { loadConfig, type LoadConfigOptions } from "../util/loadConfig";
import { createDefaultRootConfig, resolveRootConfig } from "./rootConfig";

export const loadRootConfig = (
  rootDirectory: string,
  loadOptions: LoadConfigOptions = {},
) => {
  const config = loadConfig(
    "root",
    rootDirectory,
    ROOT_CONFIG_FILE_NAME,
    ROOT_CONFIG_PACKAGE_JSON_KEY,
    (content) => resolveRootConfig(content as RootConfig),
    loadOptions,
  );
  return config ?? createDefaultRootConfig();
};
