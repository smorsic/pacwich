import fs from "fs";
import path from "path";
import { readProjectFileAtGitRef } from "../../../../affected/gitAffectedFiles";
import { PacwichError } from "../../../../internal/core";
import { logger } from "../../../../internal/logger";
import type {
  LoadCurrentLockVersionsOptions,
  LoadLockVersionsAtGitRefOptions,
  ParseLockfileWorkspaceLinksOptions,
  LockVersionMap,
  PackageManagerLockfileAdapter,
  ResolveWorkspaceDepVersionOptions,
  WorkspaceLinkResolver,
} from "../../../adapter/adapterTypes";
import {
  parseBunLockPackageVersions,
  parseBunLockWorkspaceLinkNames,
} from "./parseBunLock";

/** bun lockfile filename, relative to the project root */
export const BUN_LOCK_PROJECT_RELATIVE_PATH = "bun.lock";

const readCurrentBunLock = (rootDirectory: string): string | null => {
  const lockPath = path.join(rootDirectory, BUN_LOCK_PROJECT_RELATIVE_PATH);
  try {
    return fs.readFileSync(lockPath, "utf8");
  } catch {
    return null;
  }
};

const loadCurrentVersions = ({
  rootDirectory,
}: LoadCurrentLockVersionsOptions): LockVersionMap => {
  const contents = readCurrentBunLock(rootDirectory);
  if (contents === null) return new Map();
  const parsed = parseBunLockPackageVersions(contents);
  if (parsed instanceof PacwichError) {
    logger.warn(
      `Could not parse current bun.lock: ${parsed.message}. Treating as empty.`,
    );
    return new Map();
  }
  return parsed;
};

const loadVersionsAtGitRef = async ({
  rootDirectory,
  ref,
}: LoadLockVersionsAtGitRefOptions): Promise<LockVersionMap> => {
  const contents = await readProjectFileAtGitRef({
    rootDirectory,
    ref,
    projectRelativePath: BUN_LOCK_PROJECT_RELATIVE_PATH,
  });
  if (contents === null) return new Map();
  const parsed = parseBunLockPackageVersions(contents);
  if (parsed instanceof PacwichError) {
    logger.warn(
      `Could not parse bun.lock at ref "${ref}": ${parsed.message}. Treating as empty.`,
    );
    return new Map();
  }
  return parsed;
};

/**
 * bun.lock encodes divergent per-workspace resolutions under
 * `<workspaceName>/<depName>` when a workspace's range can't dedupe with
 * the hoisted version. Always consult that namespaced key first, then fall
 * back to the bare key for the common (hoisted) case.
 */
const resolveWorkspaceDepVersion = ({
  lock,
  workspaceName,
  depName,
}: ResolveWorkspaceDepVersionOptions): string | null =>
  lock.get(`${workspaceName}/${depName}`) ?? lock.get(depName) ?? null;

/**
 * Build a {@link WorkspaceLinkResolver} from the on-disk bun.lock. bun
 * hoists workspace entries into the top-level `packages` block, so the
 * resolver ignores `workspacePath` and answers from a per-name set.
 * Names the lockfile links resolve to `"link"`; everything else is
 * `"unknown"` (bun's static workspace-protocol/semver heuristic is
 * already correct for non-linked deps). Returns `null` when the
 * lockfile is absent or unparseable.
 */
export const loadBunWorkspaceLinks = ({
  rootDirectory,
}: ParseLockfileWorkspaceLinksOptions): WorkspaceLinkResolver | null => {
  const contents = readCurrentBunLock(rootDirectory);
  if (contents === null) return null;
  const linkedNames = parseBunLockWorkspaceLinkNames(contents);
  if (linkedNames instanceof PacwichError) {
    logger.warn(
      `Could not parse bun.lock for workspace links: ${linkedNames.message}. Falling back to static dependency analysis.`,
    );
    return null;
  }
  return {
    classify: ({ depName }) => (linkedNames.has(depName) ? "link" : "unknown"),
  };
};

export const bunLockfileAdapter: PackageManagerLockfileAdapter = {
  projectRelativePath: BUN_LOCK_PROJECT_RELATIVE_PATH,
  loadCurrentVersions,
  loadVersionsAtGitRef,
  resolveWorkspaceDepVersion,
};
