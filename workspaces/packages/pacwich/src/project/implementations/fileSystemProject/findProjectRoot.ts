import fs from "fs";
import path from "path";
import { PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH } from "../../../packageManager/backends/pnpm";

/**
 * Walk up from `startDirectory` looking for the nearest ancestor
 * directory that is a workspaces-aware project root. Two markers
 * qualify:
 *
 * - `package.json` with a `workspaces` field (bun, npm)
 * - `package.json` next to a `pnpm-workspace.yaml` (pnpm)
 *
 * Both are checked together so a nested pnpm project doesn't lose
 * to a bun/npm ancestor that happens to declare workspaces. When no
 * marker is found, fall back to the start directory so the regular
 * project-load error surfaces against the path the caller pointed
 * at instead of disappearing into a walked-up tree.
 *
 * Used both by the CLI (when `--cwd` is omitted, falls through to
 * `process.cwd()`) and by `createFileSystemProject` so any caller of
 * the public API gets the same "resolve to the real project root"
 * behavior. Pass an explicit start directory. This helper never
 * reads `process.cwd()` itself.
 */
export const findProjectRoot = (startDirectory: string): string => {
  let currentDirectory = path.resolve(startDirectory);
  while (true) {
    const packageJsonPath = path.join(currentDirectory, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      if (
        fs.existsSync(
          path.join(
            currentDirectory,
            PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH,
          ),
        )
      ) {
        return currentDirectory;
      }
      try {
        const packageJsonContent = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        if (packageJsonContent?.workspaces) {
          return currentDirectory;
        }
      } catch {
        // unreadable / invalid package.json, keep walking
      }
    }
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return path.resolve(startDirectory);
    }
    currentDirectory = parentDirectory;
  }
};
