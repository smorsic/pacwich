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
  PNPM_LOCK_PROJECT_RELATIVE_PATH,
  parsePnpmLockPackageVersions,
  parsePnpmLockWorkspaceLinks,
} from "./pnpmLock";

const readCurrentPnpmLock = (rootDirectory: string): string | null => {
  const lockPath = path.join(rootDirectory, PNPM_LOCK_PROJECT_RELATIVE_PATH);
  try {
    return fs.readFileSync(lockPath, "utf8");
  } catch {
    return null;
  }
};

const loadCurrentVersions = ({
  rootDirectory,
}: LoadCurrentLockVersionsOptions): LockVersionMap => {
  const contents = readCurrentPnpmLock(rootDirectory);
  if (contents === null) return new Map();
  const parsed = parsePnpmLockPackageVersions(contents);
  if (parsed instanceof PacwichError) {
    logger.warn(
      `Could not parse current pnpm-lock.yaml: ${parsed.message}. Treating as empty.`,
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
    projectRelativePath: PNPM_LOCK_PROJECT_RELATIVE_PATH,
  });
  if (contents === null) return new Map();
  const parsed = parsePnpmLockPackageVersions(contents);
  if (parsed instanceof PacwichError) {
    logger.warn(
      `Could not parse pnpm-lock.yaml at ref "${ref}": ${parsed.message}. Treating as empty.`,
    );
    return new Map();
  }
  return parsed;
};

/**
 * pnpm's isolated `node_modules/.pnpm/` store deduplicates by
 * `name@version` globally, and the `packages:` block in the lockfile
 * lists each resolved version once. Divergent per-workspace resolutions
 * appear as multiple entries with different peer-disambiguation
 * suffixes that all share the same base version segment. The parser
 * keeps the first occurrence, so the bare name maps to a single
 * version. Per-workspace lookup falls back to that single entry.
 */
const resolveWorkspaceDepVersion = ({
  lock,
  workspaceName: _workspaceName,
  depName,
}: ResolveWorkspaceDepVersionOptions): string | null =>
  lock.get(depName) ?? null;

/**
 * Build a {@link WorkspaceLinkResolver} from the on-disk pnpm-lock.yaml.
 * pnpm records links per-importer, so the verdict is keyed on the
 * consuming workspace's path. Returns `null` when the lockfile is
 * absent or unparseable, so callers fall back to the static heuristic.
 */
export const loadPnpmWorkspaceLinks = ({
  rootDirectory,
}: ParseLockfileWorkspaceLinksOptions): WorkspaceLinkResolver | null => {
  const contents = readCurrentPnpmLock(rootDirectory);
  if (contents === null) return null;
  const links = parsePnpmLockWorkspaceLinks(contents);
  if (links instanceof PacwichError) {
    logger.warn(
      `Could not parse pnpm-lock.yaml for workspace links: ${links.message}. Falling back to static dependency analysis.`,
    );
    return null;
  }
  return {
    classify: ({ workspacePath, depName }) => {
      const deps = links.get(workspacePath);
      if (!deps) return "unknown";
      const isLink = deps.get(depName);
      if (isLink === undefined) return "unknown";
      return isLink ? "link" : "external";
    },
  };
};

export const pnpmLockfileAdapter: PackageManagerLockfileAdapter = {
  projectRelativePath: PNPM_LOCK_PROJECT_RELATIVE_PATH,
  loadCurrentVersions,
  loadVersionsAtGitRef,
  resolveWorkspaceDepVersion,
};
