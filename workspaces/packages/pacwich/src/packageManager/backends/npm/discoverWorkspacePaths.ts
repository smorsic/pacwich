import path from "path";
import { PacwichError } from "../../../internal/core";
import type {
  DiscoverWorkspacePathsOptions,
  DiscoverWorkspacePathsResult,
} from "../../adapter/adapterTypes";
import { NPM_ERRORS } from "./errors";
import {
  extractWorkspaceRelativePaths,
  readPackageLockfile,
} from "./packageLock";

/**
 * npm has already resolved the project's workspaces by the time
 * `npm install` writes `package-lock.json`. The lockfile's
 * `packages` map enumerates them directly (every non-empty key that
 * does NOT live under `node_modules/`). We read from there rather
 * than walking `workspaceGlobs` to mirror bun's behavior: a single
 * source of truth, resolved at install time.
 *
 * `workspaceGlobs` is accepted to satisfy the adapter contract but
 * goes unused. Backends that don't have a lockfile-listed workspace
 * set would walk the globs instead.
 */
export const discoverWorkspacePaths = ({
  rootDirectory,
  workspaceGlobs: _workspaceGlobs,
}: DiscoverWorkspacePathsOptions): DiscoverWorkspacePathsResult => {
  const lock = readPackageLockfile(rootDirectory);

  if (lock instanceof PacwichError) {
    if (lock instanceof NPM_ERRORS.NpmLockNotFound) {
      lock.message =
        `No package-lock.json found at ${rootDirectory}. Check that this is the directory of your project and that you've run 'npm install'.` +
        " If you have run 'npm install', you may simply have no workspaces or dependencies in your project.";
    }
    throw lock;
  }

  const relativePaths = extractWorkspaceRelativePaths(lock);
  return {
    // Workspace paths from the lockfile + always include root.
    absolutePaths: [
      rootDirectory,
      ...relativePaths.map((p) => path.join(rootDirectory, p)),
    ],
  };
};
