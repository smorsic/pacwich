import path from "path";
import * as vscode from "vscode";
import { debounce } from "./debounce";

const WATCH_PATTERNS = [
  "**/package.json",
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "pacwich.project.{ts,js,jsonc,json}",
  "**/pacwich.workspace.{ts,js,jsonc,json}",
];

const isNodeModulesPath = (fsPath: string): boolean =>
  fsPath.split(path.sep).includes("node_modules");

/**
 * Watches the resolved project root (not the whole opened folder - the
 * pacwich project can be a subdirectory of it, see the projectRoot setting)
 * for changes to anything that affects workspace discovery or metadata, and
 * calls `onRelevantChange` on a debounced trailing edge.
 */
export const createWorkspacesFileWatcher = (
  projectRoot: string,
  onRelevantChange: () => void,
): vscode.Disposable => {
  const scheduleRefresh = debounce(onRelevantChange, {
    waitMs: 500,
    maxWaitMs: 2000,
  });

  const disposables: vscode.Disposable[] = [];

  for (const pattern of WATCH_PATTERNS) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(projectRoot, pattern),
    );

    const handleEvent = (uri: vscode.Uri) => {
      if (isNodeModulesPath(uri.fsPath)) return;
      scheduleRefresh();
    };

    disposables.push(
      watcher,
      watcher.onDidCreate(handleEvent),
      watcher.onDidChange(handleEvent),
      watcher.onDidDelete(handleEvent),
    );
  }

  return vscode.Disposable.from(...disposables);
};
