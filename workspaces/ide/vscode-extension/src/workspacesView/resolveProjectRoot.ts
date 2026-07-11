import path from "path";
import * as vscode from "vscode";

export const CONFIG_SECTION = "pacwich";
export const PROJECT_ROOT_SETTING = "projectRoot";

export const getProjectRootSetting = (): string =>
  vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string>(PROJECT_ROOT_SETTING, "");

export const resolveProjectRoot = (
  workspaceFolder: vscode.WorkspaceFolder,
): string => {
  const setting = getProjectRootSetting().trim();
  if (!setting) return workspaceFolder.uri.fsPath;
  return path.isAbsolute(setting)
    ? setting
    : path.resolve(workspaceFolder.uri.fsPath, setting);
};
