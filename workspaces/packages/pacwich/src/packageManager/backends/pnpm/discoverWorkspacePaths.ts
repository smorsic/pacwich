import path from "path";
import { PacwichError } from "../../../internal/core";
import type {
  DiscoverWorkspacePathsOptions,
  DiscoverWorkspacePathsResult,
} from "../../adapter/adapterTypes";
import { PNPM_ERRORS } from "./errors";
import { extractWorkspaceRelativePaths, readPnpmLockfile } from "./pnpmLock";

/**
 * pnpm enumerates every workspace (including those with no deps) under
 * `importers` in `pnpm-lock.yaml`, so we read paths from the lockfile
 * the same way the npm and bun backends do (single source of truth,
 * resolved at install time). `workspaceGlobs` is accepted to satisfy
 * the contract but unused.
 */
export const discoverWorkspacePaths = ({
  rootDirectory,
  workspaceGlobs: _workspaceGlobs,
}: DiscoverWorkspacePathsOptions): DiscoverWorkspacePathsResult => {
  const lock = readPnpmLockfile(rootDirectory);

  if (lock instanceof PacwichError) {
    if (lock instanceof PNPM_ERRORS.PnpmLockNotFound) {
      lock.message =
        `No pnpm-lock.yaml found at ${rootDirectory}. Check that this is the directory of your project and that you've run 'pnpm install'.` +
        " If you have run 'pnpm install', you may simply have no workspaces or dependencies in your project.";
    }
    throw lock;
  }

  const relativePaths = extractWorkspaceRelativePaths(lock);
  return {
    absolutePaths: [
      rootDirectory,
      ...relativePaths.map((p) => path.join(rootDirectory, p)),
    ],
  };
};
