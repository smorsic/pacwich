import fs from "fs";
import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import { type PacwichError, parseJSONC } from "../../../internal/core";
import { logger } from "../../../internal/logger";
import { NPM_ERRORS } from "./errors";

/**
 * Relevant subset of an entry in `package-lock.json` v2/v3's `packages`
 * map. The keys are project-relative paths:
 *   - `""`: root project
 *   - `"packages/a"`: a workspace at that path (any non-`node_modules/`
 *     key with a `package.json`)
 *   - `"node_modules/<name>"`: an installed external dependency
 *   - `"node_modules/<a>/node_modules/<b>"`: a nested dep (e.g. when
 *     the hoisted version doesn't satisfy a transitive range)
 *   - workspace symlinks under `node_modules/` have `"link": true`
 *     and a `"resolved": "<workspace-path>"` field
 */
export type RelevantPackageLockEntry = {
  name?: string;
  version?: string;
  link?: boolean;
  resolved?: string;
};

/** Relevant subset of the v2/v3 `package-lock.json` shape. */
export type RelevantPackageLock = {
  lockfileVersion: number;
  packages: Record<string, RelevantPackageLockEntry>;
};

/**
 * v2 introduced the top-level `packages` map alongside the legacy v1
 * `dependencies` tree; v3 dropped the legacy tree. pacwich's npm adapter
 * requires the `packages` map, so v2 is the minimum. A lockfile newer
 * than the max is parsed leniently (warn + clamp to max) on the bet that
 * the `packages` shape stayed compatible; the structural guards in
 * {@link parsePackageLock} remain the real safety net. v1 (older npm, no
 * `packages` map) is rejected as
 * {@link NPM_ERRORS.UnsupportedNpmLockVersion}.
 */
export const MIN_SUPPORTED_NPM_LOCK_VERSION = 2;
export const MAX_SUPPORTED_NPM_LOCK_VERSION = 3;

const NODE_MODULES_PREFIX = "node_modules/";

/** Project-relative path to `package-lock.json`. */
export const NPM_LOCK_PROJECT_RELATIVE_PATH = "package-lock.json";

export const parsePackageLock = (
  jsonString: string,
  /** Only used for error messages */
  npmLockPath?: string,
): RelevantPackageLock | PacwichError => {
  let raw: { lockfileVersion?: unknown; packages?: unknown } | null = null;
  try {
    raw = parseJSONC(jsonString);
  } catch (error) {
    return new NPM_ERRORS.MalformedNpmLock(
      `Failed to parse npm lockfile ${npmLockPath ? `at "${npmLockPath}"` : ""}: ${
        (error as Error).message
      }`,
    );
  }

  if (!isJSONObject(raw)) {
    return new NPM_ERRORS.MalformedNpmLock(
      `npm lockfile ${npmLockPath ? `at "${npmLockPath}"` : ""} is not a valid JSON object`,
    );
  }

  const lockfileVersion = raw.lockfileVersion;
  if (typeof lockfileVersion !== "number") {
    return new NPM_ERRORS.MalformedNpmLock(
      `npm lockfile ${npmLockPath ? `at "${npmLockPath}"` : ""} has an invalid lockfileVersion field of type ${typeof lockfileVersion}: ${lockfileVersion}`,
    );
  }

  // Strict low: v1 has no top-level `packages` map, so its data can't
  // be reconstructed.
  if (lockfileVersion < MIN_SUPPORTED_NPM_LOCK_VERSION) {
    return new NPM_ERRORS.UnsupportedNpmLockVersion(
      `Unsupported npm lockfile version ${npmLockPath ? `at "${npmLockPath}"` : ""}: ${lockfileVersion} (Supported: >=${MIN_SUPPORTED_NPM_LOCK_VERSION} <=${MAX_SUPPORTED_NPM_LOCK_VERSION})`,
    );
  }

  // Lenient high: a newer format is probably still compatible for the
  // fields we read. Warn and parse it as the newest version we know.
  if (lockfileVersion > MAX_SUPPORTED_NPM_LOCK_VERSION) {
    logger.warn("NpmLockNewerVersion", {
      atPath: npmLockPath ? ` at "${npmLockPath}"` : "",
      version: String(lockfileVersion),
      maxVersion: String(MAX_SUPPORTED_NPM_LOCK_VERSION),
    });
  }

  const packagesField = raw.packages;
  if (packagesField !== undefined && !isJSONObject(packagesField)) {
    return new NPM_ERRORS.MalformedNpmLock(
      `npm lockfile ${npmLockPath ? `at "${npmLockPath}"` : ""} has an invalid packages field of type ${typeof packagesField}: ${packagesField}`,
    );
  }

  return {
    // Clamp so any future version-branched logic treats a newer file as
    // the newest version we understand.
    lockfileVersion: Math.min(lockfileVersion, MAX_SUPPORTED_NPM_LOCK_VERSION),
    packages: (packagesField as Record<string, RelevantPackageLockEntry>) ?? {},
  };
};

export const readPackageLockfile = (
  directory: string,
): RelevantPackageLock | PacwichError => {
  const npmLockPath = path.join(
    directory.replace(
      new RegExp(`(\\/*)?${NPM_LOCK_PROJECT_RELATIVE_PATH}$`),
      "",
    ),
    NPM_LOCK_PROJECT_RELATIVE_PATH,
  );
  if (!fs.existsSync(npmLockPath)) {
    return new NPM_ERRORS.NpmLockNotFound(
      `Did not find npm lockfile at "${npmLockPath}"`,
    );
  }
  const jsonString = fs.readFileSync(npmLockPath, "utf8");
  return parsePackageLock(jsonString, npmLockPath);
};

/**
 * Project-relative keys in `packages` that represent workspaces (not
 * external deps and not the root). Excludes `""` (root) and anything
 * with a `node_modules/` segment. Sort is preserved from the lockfile
 * for stable ordering.
 */
export const extractWorkspaceRelativePaths = (
  lock: RelevantPackageLock,
): string[] =>
  Object.keys(lock.packages).filter(
    (key) =>
      key !== "" &&
      !key.startsWith(NODE_MODULES_PREFIX) &&
      !key.includes(`/${NODE_MODULES_PREFIX}`),
  );

/**
 * Map of dependency name → resolved version from
 * `package-lock.json`'s `packages` map. Only top-level
 * `node_modules/<name>` entries with a concrete `version` are
 * tracked (the hoisted set). Symlinks to workspaces (`"link": true`)
 * are skipped. Those track to the local workspace, not a
 * registry-resolved version, so they're not useful for affected
 * detection.
 *
 * Nested entries (`node_modules/<a>/node_modules/<b>`) are skipped
 * for the same reason bun.lock's per-workspace divergence is
 * surfaced through namespaced keys: a separate resolution step in
 * the lockfile adapter (resolveWorkspaceDepVersion) is responsible
 * for picking the right entry per workspace. npm hoists aggressively
 * enough that the top-level set is the correct baseline.
 */
export type NpmLockVersionMap = Map<string, string>;

/**
 * Set of dependency names that `package-lock.json` records as resolving
 * to a local workspace. npm hoists workspace symlinks to the top-level
 * `node_modules/<name>` with `"link": true`, so a single per-name set
 * (independent of the consuming workspace) is authoritative: a name
 * either links project-wide or it doesn't (a version conflict would
 * fail the install before a lockfile is written). Scoped names keep
 * their `@scope/` prefix.
 */
export const parsePackageLockWorkspaceLinkNames = (
  jsonString: string,
  npmLockPath?: string,
): Set<string> | PacwichError => {
  const parsed = parsePackageLock(jsonString, npmLockPath);
  if (parsed instanceof Error) return parsed as PacwichError;

  const names = new Set<string>();
  for (const [key, entry] of Object.entries(parsed.packages)) {
    if (!entry.link) continue;
    if (!key.startsWith(NODE_MODULES_PREFIX)) continue;
    const rest = key.slice(NODE_MODULES_PREFIX.length);
    // Only top-level (hoisted) symlinks; nested entries aren't workspaces.
    if (rest.includes(`/${NODE_MODULES_PREFIX}`)) continue;
    if (rest) names.add(rest);
  }
  return names;
};

export const parsePackageLockPackageVersions = (
  jsonString: string,
  npmLockPath?: string,
): NpmLockVersionMap | PacwichError => {
  const parsed = parsePackageLock(jsonString, npmLockPath);
  if (parsed instanceof Error) return parsed as PacwichError;

  const versions: NpmLockVersionMap = new Map();
  for (const [key, entry] of Object.entries(parsed.packages)) {
    if (!key.startsWith(NODE_MODULES_PREFIX)) continue;
    // Skip nested deps. Only the hoisted top-level entries matter.
    const rest = key.slice(NODE_MODULES_PREFIX.length);
    if (rest.includes(`/${NODE_MODULES_PREFIX}`)) continue;
    // Workspace symlinks aren't registry-resolved.
    if (entry.link) continue;
    if (typeof entry.version !== "string" || !entry.version) continue;
    versions.set(rest, entry.version);
  }
  return versions;
};
