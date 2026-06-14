import {
  WORKSPACE_CONFIG_FILE_NAME,
  WORKSPACE_CONFIG_PACKAGE_JSON_KEY,
  type WorkspaceConfig,
} from "@pacwich/common/config";
import { loadConfig, type LoadConfigOptions } from "../util/loadConfig";
import {
  createDefaultWorkspaceConfig,
  resolveWorkspaceConfig,
} from "./workspaceConfig";

export const loadWorkspaceConfig = (
  workspacePath: string,
  loadOptions: LoadConfigOptions = {},
) => {
  const config = loadConfig(
    "workspace",
    workspacePath,
    WORKSPACE_CONFIG_FILE_NAME,
    WORKSPACE_CONFIG_PACKAGE_JSON_KEY,
    (content) => resolveWorkspaceConfig(content as WorkspaceConfig),
    loadOptions,
  );
  return config ?? createDefaultWorkspaceConfig();
};
