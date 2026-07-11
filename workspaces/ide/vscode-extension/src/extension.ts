import * as vscode from "vscode";
import {
  createWorkspacesFileWatcher,
  registerWorkspacesCommands,
  resolveProjectRoot,
  WorkspacesTreeDataProvider,
} from "./workspacesView";

export const activate = (context: vscode.ExtensionContext): void => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const provider = new WorkspacesTreeDataProvider(workspaceFolder);

  const treeView = vscode.window.createTreeView("pacwich.workspaces", {
    treeDataProvider: provider,
  });
  context.subscriptions.push(treeView);

  registerWorkspacesCommands(context, provider);

  let watcherDisposable: vscode.Disposable | undefined;

  const stopWatching = () => {
    watcherDisposable?.dispose();
    watcherDisposable = undefined;
  };

  const startWatching = () => {
    if (watcherDisposable || !workspaceFolder) return;
    const projectRoot = resolveProjectRoot(workspaceFolder);
    watcherDisposable = createWorkspacesFileWatcher(projectRoot, () =>
      provider.refresh(),
    );
  };

  context.subscriptions.push(
    treeView.onDidChangeVisibility((event) => {
      if (event.visible) {
        provider.refresh();
        startWatching();
      } else {
        stopWatching();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("pacwich.projectRoot")) return;
      stopWatching();
      provider.refresh();
      if (treeView.visible) startWatching();
    }),
    { dispose: stopWatching },
  );

  if (treeView.visible) startWatching();
};
