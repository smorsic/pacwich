import fs from "fs";
import path from "path";
import type { Workspace } from "pacwich";

const WORKSPACE_CONFIG_FILE_NAMES = [
  "pacwich.workspace.ts",
  "pacwich.workspace.js",
  "pacwich.workspace.jsonc",
  "pacwich.workspace.json",
];

export const findWorkspaceConfigFilePath = (
  projectRoot: string,
  workspace: Workspace,
): string | undefined => {
  const workspaceDirectory = path.resolve(projectRoot, workspace.path);

  for (const fileName of WORKSPACE_CONFIG_FILE_NAMES) {
    const filePath = path.join(workspaceDirectory, fileName);
    if (fs.existsSync(filePath)) return filePath;
  }

  return undefined;
};
