import {
  createFileSystemProject,
  type FileSystemProject,
  type Workspace,
} from "pacwich";
import * as vscode from "vscode";
import { resolveProjectRoot } from "./resolveProjectRoot";
import {
  MessageTreeItem,
  WorkspaceInfoTreeItem,
  WorkspaceTreeItem,
  type PacwichTreeItem,
} from "./treeItems";

export class WorkspacesTreeDataProvider implements vscode.TreeDataProvider<PacwichTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    PacwichTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private project: FileSystemProject | undefined;
  private projectRoot: string | undefined;
  private loadError: string | undefined;

  constructor(
    private readonly workspaceFolder: vscode.WorkspaceFolder | undefined,
  ) {
    this.load();
  }

  refresh(): void {
    this.load();
    this.onDidChangeTreeDataEmitter.fire();
  }

  getProjectRoot(): string | undefined {
    return this.projectRoot;
  }

  listWorkspaces(): Workspace[] | undefined {
    return this.project?.workspaces;
  }

  getTreeItem(element: PacwichTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PacwichTreeItem): PacwichTreeItem[] {
    if (!element) return this.rootChildren();
    if (element instanceof WorkspaceTreeItem) {
      return workspaceInfoChildren(element.workspace);
    }
    return [];
  }

  private rootChildren(): PacwichTreeItem[] {
    if (this.loadError) return [new MessageTreeItem(this.loadError)];
    if (!this.project || !this.projectRoot) return [];

    const projectRoot = this.projectRoot;
    return [...this.project.workspaces]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((workspace) => new WorkspaceTreeItem(workspace, projectRoot));
  }

  private load(): void {
    this.project = undefined;
    this.projectRoot = undefined;
    this.loadError = undefined;

    if (!this.workspaceFolder) {
      this.loadError = "Open a folder to see pacwich workspaces.";
      return;
    }

    this.projectRoot = resolveProjectRoot(this.workspaceFolder);

    try {
      this.project = createFileSystemProject({
        rootDirectory: this.projectRoot,
      });
    } catch (error) {
      this.loadError = `Couldn't load a pacwich project at "${this.projectRoot}": ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }
}

const workspaceInfoChildren = (
  workspace: Workspace,
): WorkspaceInfoTreeItem[] => {
  const children = [
    new WorkspaceInfoTreeItem(`Path: ${workspace.path || "."}`, "folder"),
  ];

  if (workspace.aliases.length) {
    children.push(
      new WorkspaceInfoTreeItem(
        `Alias: ${workspace.aliases.join(", ")}`,
        "symbol-key",
      ),
    );
  }

  if (workspace.tags.length) {
    children.push(
      new WorkspaceInfoTreeItem(`Tags: ${workspace.tags.join(", ")}`, "tag"),
    );
  }

  if (workspace.scripts.length) {
    children.push(
      new WorkspaceInfoTreeItem(
        `Scripts (${workspace.scripts.length}): ${workspace.scripts.join(", ")}`,
        "terminal",
      ),
    );
  }

  return children;
};
