import fs from "fs";
import path from "path";
import { readProjectFileAtGitRef } from "../../../affected/gitAffectedFiles";
import { PacwichError } from "../../../internal/core";
import { logger } from "../../../internal/logger";
import type {
  LoadCurrentLockVersionsOptions,
  LoadLockVersionsAtGitRefOptions,
  ParseLockfileWorkspaceLinksOptions,
  LockVersionMap,
  PackageManagerLockfileAdapter,
  ResolveWorkspaceDepVersionOptions,
  WorkspaceLinkResolver,
} from "../../adapter/adapterTypes";
import {
  NPM_LOCK_PROJECT_RELATIVE_PATH,
  parsePackageLockPackageVersions,
  parsePackageLockWorkspaceLinkNames,
} from "./packageLock";

const readCurrentNpmLock = (rootDirectory: string): string | null => {
  const lockPath = path.join(rootDirectory, NPM_LOCK_PROJECT_RELATIVE_PATH);
  try {
    return fs.readFileSync(lockPath, "utf8");
  } catch {
    return null;
  }
};

const loadCurrentVersions = ({
  rootDirectory,
}: LoadCurrentLockVersionsOptions): LockVersionMap => {
  const contents = readCurrentNpmLock(rootDirectory);
  if (contents === null) return new Map();
  const parsed = parsePackageLockPackageVersions(contents);
  if (parsed instanceof PacwichError) {
    logger.warn("NpmLockParseFailed", {
      context: "current package-lock.json",
      detail: parsed.message,
      fallback: "Treating as empty.",
    });
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
    projectRelativePath: NPM_LOCK_PROJECT_RELATIVE_PATH,
  });
  if (contents === null) return new Map();
  const parsed = parsePackageLockPackageVersions(contents);
  if (parsed instanceof PacwichError) {
    logger.warn("NpmLockParseFailed", {
      context: `package-lock.json at ref "${ref}"`,
      detail: parsed.message,
      fallback: "Treating as empty.",
    });
    return new Map();
  }
  return parsed;
};

/**
 * npm hoists all deps to the top-level `node_modules/`, so a single
 * resolved version per dep name is the common case. Unlike bun (which
 * encodes divergent per-workspace resolutions under a namespaced
 * `<workspaceName>/<depName>` key), npm relies on nested
 * `node_modules/.../node_modules/<dep>` entries, which the version
 * parser intentionally skips. Net effect: per-workspace resolution
 * always falls back to the bare hoisted version.
 */
const resolveWorkspaceDepVersion = ({
  lock,
  workspaceName: _workspaceName,
  depName,
}: ResolveWorkspaceDepVersionOptions): string | null =>
  lock.get(depName) ?? null;

/**
 * Build a {@link WorkspaceLinkResolver} from the on-disk
 * package-lock.json. npm hoists workspace links globally, so the
 * resolver ignores `workspacePath` and answers from a per-name set.
 * Names the lockfile links resolve to `"link"`; everything else is
 * `"unknown"` (npm's static name+semver heuristic is already correct
 * for non-linked deps, so deferring to it loses nothing). Returns
 * `null` when the lockfile is absent or unparseable.
 */
export const loadNpmWorkspaceLinks = ({
  rootDirectory,
}: ParseLockfileWorkspaceLinksOptions): WorkspaceLinkResolver | null => {
  const contents = readCurrentNpmLock(rootDirectory);
  if (contents === null) return null;
  const linkedNames = parsePackageLockWorkspaceLinkNames(contents);
  if (linkedNames instanceof PacwichError) {
    logger.warn("NpmLockParseFailed", {
      context: "package-lock.json for workspace links",
      detail: linkedNames.message,
      fallback: "Falling back to static dependency analysis.",
    });
    return null;
  }
  return {
    classify: ({ depName }) => (linkedNames.has(depName) ? "link" : "unknown"),
  };
};

export const npmLockfileAdapter: PackageManagerLockfileAdapter = {
  projectRelativePath: NPM_LOCK_PROJECT_RELATIVE_PATH,
  loadCurrentVersions,
  loadVersionsAtGitRef,
  resolveWorkspaceDepVersion,
};
