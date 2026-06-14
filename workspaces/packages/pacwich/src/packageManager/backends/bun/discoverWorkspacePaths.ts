import path from "path";
import { PacwichError } from "../../../internal/core";
import type {
  DiscoverWorkspacePathsOptions,
  DiscoverWorkspacePathsResult,
} from "../../adapter/adapterTypes";
import { BUN_LOCK_ERRORS, readBunLockfile } from "./lockfile/parseBunLock";

/**
 * Bun records the resolved set of workspace directories in `bun.lock`. We
 * read it once and return absolute paths. If the lockfile is missing the
 * "did you run `bun install`?" hint is surfaced via a {@link PacwichError}
 * so the CLI can render it without a stack trace.
 *
 * `workspaceGlobs` is accepted to satisfy the adapter contract. Bun does
 * not need them at discovery time since the lockfile already enumerates
 * the matched paths, but future backends will walk the globs directly.
 */
export const discoverWorkspacePaths = ({
  rootDirectory,
  workspaceGlobs: _workspaceGlobs,
}: DiscoverWorkspacePathsOptions): DiscoverWorkspacePathsResult => {
  const bunLock = readBunLockfile(rootDirectory);

  if (bunLock instanceof PacwichError) {
    if (bunLock instanceof BUN_LOCK_ERRORS.BunLockNotFound) {
      bunLock.message =
        `No bun.lock found at ${rootDirectory}. Check that this is the directory of your project and that you've ran 'bun install'.` +
        " If you have ran 'bun install', you may simply have no workspaces or dependencies in your project.";
    }
    throw bunLock;
  }

  return {
    absolutePaths: Object.keys(bunLock.workspaces).map((workspacePath) =>
      path.join(rootDirectory, workspacePath),
    ),
  };
};
