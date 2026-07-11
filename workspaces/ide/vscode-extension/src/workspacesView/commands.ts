import path from "path";
import * as vscode from "vscode";
import type { WorkspacesTreeDataProvider } from "./treeDataProvider";
import { type WorkspaceTreeItem } from "./treeItems";
import { findWorkspaceConfigFilePath } from "./workspaceConfigFile";

const openFile = async (filePath: string): Promise<void> => {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document);
};

export const registerWorkspacesCommands = (
  context: vscode.ExtensionContext,
  provider: WorkspacesTreeDataProvider,
): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand("pacwich.workspaces.refresh", () =>
      provider.refresh(),
    ),

    vscode.commands.registerCommand(
      "pacwich.workspaces.revealInExplorer",
      async (item: WorkspaceTreeItem) => {
        await vscode.commands.executeCommand(
          "revealInExplorer",
          vscode.Uri.file(item.directory),
        );
      },
    ),

    vscode.commands.registerCommand(
      "pacwich.workspaces.openPackageJson",
      async (item: WorkspaceTreeItem) => {
        await openFile(path.join(item.directory, "package.json"));
      },
    ),

    vscode.commands.registerCommand(
      "pacwich.workspaces.openWorkspaceConfig",
      async (item: WorkspaceTreeItem) => {
        const configPath = findWorkspaceConfigFilePath(
          item.projectRoot,
          item.workspace,
        );
        if (configPath) await openFile(configPath);
      },
    ),

    vscode.commands.registerCommand(
      "pacwich.workspaces.goToWorkspace",
      async () => {
        const workspaces = provider.listWorkspaces();
        const projectRoot = provider.getProjectRoot();
        if (!workspaces || !projectRoot) return;

        const picked = await vscode.window.showQuickPick(
          workspaces
            .map((workspace) => ({
              label: workspace.name,
              description: workspace.path || ".",
              workspace,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
          { placeHolder: "Go to pacwich workspace" },
        );
        if (!picked) return;

        await vscode.commands.executeCommand(
          "revealInExplorer",
          vscode.Uri.file(path.resolve(projectRoot, picked.workspace.path)),
        );
      },
    ),
  );
};
