import path from "path";
import type { Workspace } from "pacwich";
import * as vscode from "vscode";
import { findWorkspaceConfigFilePath } from "./workspaceConfigFile";

export class WorkspaceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workspace: Workspace,
    public readonly projectRoot: string,
  ) {
    super(workspace.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.id = workspace.name;
    this.description = workspace.path || ".";
    this.iconPath = new vscode.ThemeIcon(
      workspace.isRoot ? "root-folder" : "package",
    );
    this.tooltip = [
      workspace.path || ".",
      workspace.tags.length ? `Tags: ${workspace.tags.join(", ")}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");
    this.contextValue = findWorkspaceConfigFilePath(projectRoot, workspace)
      ? "pacwich.workspace.withConfig"
      : "pacwich.workspace";
    this.command = {
      command: "pacwich.workspaces.openPackageJson",
      title: "Open package.json",
      arguments: [this],
    };
  }

  get directory(): string {
    return path.resolve(this.projectRoot, this.workspace.path);
  }
}

export class WorkspaceInfoTreeItem extends vscode.TreeItem {
  constructor(label: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = "pacwich.workspaceInfo";
  }
}

export class MessageTreeItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "pacwich.message";
  }
}

export type PacwichTreeItem =
  WorkspaceTreeItem | WorkspaceInfoTreeItem | MessageTreeItem;
