import fs from "fs";
import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import { parse as parseYaml } from "../../../internal/bundledDeps/yaml";
import { type PacwichError } from "../../../internal/core";
import { logger } from "../../../internal/logger";
import { PNPM_ERRORS } from "./errors";

/** Project-relative path to `pnpm-lock.yaml`. */
export const PNPM_LOCK_PROJECT_RELATIVE_PATH = "pnpm-lock.yaml";

/**
 * pnpm-lock.yaml has used a YAML format since well before v9. The
 * `importers` and `packages` top-level keys (the only ones pacwich
 * reads from) have been stable across v5 → v9. We accept any version
 * within this range but warn if the lockfile is from an unfamiliar
 * future format.
 *
 * v6 dropped the legacy `dependencies`/`packages` flat layout in favor
 * of `importers`/`packages`/`snapshots`. v5 and earlier are NOT
 * supported (the data we need would have to be reconstructed from a
 * different shape).
 */
export const MIN_SUPPORTED_PNPM_LOCK_VERSION = 6;
export const MAX_SUPPORTED_PNPM_LOCK_VERSION = 9;

/**
 * Relevant subset of a pnpm-lock.yaml `importers` entry. Workspace
 * deps appear as `{ specifier, version }` with `version` starting
 * `link:` for local links. External deps carry the resolved
 * registry version directly (after the last `(` in some peer-resolved
 * specifiers, we strip suffix metadata when normalizing).
 */
export type RelevantPnpmLockImporter = Record<string, unknown>;

export type RelevantPnpmLock = {
  /**
   * Some legacy/edge cases write the lockfile version as a string
   * (e.g. `'9.0'`), so we coerce to a number.
   */
  lockfileVersion: number;
  /** Project-relative workspace path → importer entry */
  importers: Record<string, RelevantPnpmLockImporter>;
  /** `<name>@<resolved-version>` → arbitrary package metadata (only key matters) */
  packages: Record<string, unknown>;
};

const parseLockfileVersion = (raw: unknown): number | null => {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export const parsePnpmLock = (
  yamlString: string,
  /** Only used for error messages */
  pnpmLockPath?: string,
): RelevantPnpmLock | PacwichError => {
  let raw: unknown;
  try {
    raw = parseYaml(yamlString);
  } catch (error) {
    return new PNPM_ERRORS.MalformedPnpmLock(
      `Failed to parse pnpm lockfile${pnpmLockPath ? ` at "${pnpmLockPath}"` : ""}: ${
        (error as Error).message
      }`,
    );
  }

  if (!isJSONObject(raw)) {
    return new PNPM_ERRORS.MalformedPnpmLock(
      `pnpm lockfile${pnpmLockPath ? ` at "${pnpmLockPath}"` : ""} is not a valid YAML mapping`,
    );
  }

  const version = parseLockfileVersion(raw.lockfileVersion);
  if (version === null) {
    return new PNPM_ERRORS.MalformedPnpmLock(
      `pnpm lockfile${pnpmLockPath ? ` at "${pnpmLockPath}"` : ""} has an invalid lockfileVersion field: ${String(raw.lockfileVersion)}`,
    );
  }

  // Strict low: v5 and earlier use a flat layout we can't reconstruct.
  if (version < MIN_SUPPORTED_PNPM_LOCK_VERSION) {
    return new PNPM_ERRORS.UnsupportedPnpmLockVersion(
      `Unsupported pnpm lockfile version${pnpmLockPath ? ` at "${pnpmLockPath}"` : ""}: ${version} (Supported: >=${MIN_SUPPORTED_PNPM_LOCK_VERSION} <=${MAX_SUPPORTED_PNPM_LOCK_VERSION}.x)`,
    );
  }

  // Lenient high: a newer major is probably still compatible for the
  // fields we read. Warn and parse it as the newest version we know.
  if (Math.floor(version) > MAX_SUPPORTED_PNPM_LOCK_VERSION) {
    logger.warn("PnpmLockNewerVersion", {
      atPath: pnpmLockPath ? ` at "${pnpmLockPath}"` : "",
      version: String(version),
      maxVersion: String(MAX_SUPPORTED_PNPM_LOCK_VERSION),
    });
  }

  const importersField = raw.importers;
  const importers: Record<string, RelevantPnpmLockImporter> = {};
  if (importersField !== undefined) {
    if (!isJSONObject(importersField)) {
      return new PNPM_ERRORS.MalformedPnpmLock(
        `pnpm lockfile${pnpmLockPath ? ` at "${pnpmLockPath}"` : ""} has an invalid importers field`,
      );
    }
    for (const [key, entry] of Object.entries(importersField)) {
      if (isJSONObject(entry)) importers[key] = entry;
    }
  }

  const packagesField = raw.packages;
  const packages: Record<string, unknown> = {};
  if (packagesField !== undefined) {
    if (!isJSONObject(packagesField)) {
      return new PNPM_ERRORS.MalformedPnpmLock(
        `pnpm lockfile${pnpmLockPath ? ` at "${pnpmLockPath}"` : ""} has an invalid packages field`,
      );
    }
    Object.assign(packages, packagesField);
  }

  return {
    // Clamp a newer-than-max major down so any future version-branched
    // logic treats it as the newest major we understand. In-range minor
    // versions (e.g. 9.0) are preserved as-is.
    lockfileVersion:
      Math.floor(version) > MAX_SUPPORTED_PNPM_LOCK_VERSION
        ? MAX_SUPPORTED_PNPM_LOCK_VERSION
        : version,
    importers,
    packages,
  };
};

export const readPnpmLockfile = (
  directory: string,
): RelevantPnpmLock | PacwichError => {
  const pnpmLockPath = path.join(directory, PNPM_LOCK_PROJECT_RELATIVE_PATH);
  if (!fs.existsSync(pnpmLockPath)) {
    return new PNPM_ERRORS.PnpmLockNotFound(
      `Did not find pnpm lockfile at "${pnpmLockPath}"`,
    );
  }
  const contents = fs.readFileSync(pnpmLockPath, "utf8");
  return parsePnpmLock(contents, pnpmLockPath);
};

/**
 * Project-relative workspace paths from `importers`. Skips the root
 * importer key (`"."`); the discovery layer reattaches the root path
 * the same way the bun/npm backends do.
 */
export const extractWorkspaceRelativePaths = (
  lock: RelevantPnpmLock,
): string[] =>
  Object.keys(lock.importers).filter((key) => key !== "" && key !== ".");

/**
 * Map of dependency name → resolved version from pnpm-lock.yaml's
 * `packages` block. Keys are `<name>@<version>` (with peer-dep
 * disambiguation suffixes like `chalk@5.6.2(react@19.0.0)` that we
 * strip). The last `@` separates name from version, handling scoped
 * names like `@scope/foo@1.2.3`.
 *
 * Workspace dep entries (which would appear as `version: link:...`
 * under `importers`) are not present in `packages`. They only live
 * in importers, so no special filtering is needed here.
 */
export type PnpmLockVersionMap = Map<string, string>;

/**
 * Workspace-link map derived from a pnpm-lock.yaml's `importers`:
 * `<importerPath>` → (`<depName>` → `isLink`). The importer path is
 * the consuming workspace's project-relative path (the root importer
 * `"."` is normalized to `""` to match `Workspace.path`). `isLink` is
 * true when the importer recorded the dep with a `link:` version,
 * meaning pnpm resolved it to a local workspace — independent of the
 * specifier the user wrote (`workspace:*`, `^1.0.0`, …) and of
 * `linkWorkspacePackages`.
 */
export type PnpmWorkspaceLinkMap = Map<string, Map<string, boolean>>;

const PNPM_LINK_VERSION_PREFIX = "link:";

/** Importer sub-keys that hold a workspace's declared dependencies. */
const PNPM_IMPORTER_DEP_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
] as const;

export const parsePnpmLockWorkspaceLinks = (
  yamlString: string,
  pnpmLockPath?: string,
): PnpmWorkspaceLinkMap | PacwichError => {
  const parsed = parsePnpmLock(yamlString, pnpmLockPath);
  if (parsed instanceof Error) return parsed as PacwichError;

  const links: PnpmWorkspaceLinkMap = new Map();
  for (const [importerKey, importer] of Object.entries(parsed.importers)) {
    const workspacePath = importerKey === "." ? "" : importerKey;
    const deps = new Map<string, boolean>();
    for (const group of PNPM_IMPORTER_DEP_GROUPS) {
      const groupValue = (importer as Record<string, unknown>)[group];
      if (!isJSONObject(groupValue)) continue;
      for (const [depName, entry] of Object.entries(groupValue)) {
        // Each entry is `{ specifier, version }`. A workspace link
        // carries a `link:<relativePath>` version; anything else
        // resolved to the registry.
        const version = isJSONObject(entry) ? entry.version : undefined;
        const isLink =
          typeof version === "string" &&
          version.startsWith(PNPM_LINK_VERSION_PREFIX);
        // First group wins; the same name shouldn't appear across
        // groups, but if it does a recorded link is the stronger signal.
        if (!deps.has(depName) || isLink) deps.set(depName, isLink);
      }
    }
    links.set(workspacePath, deps);
  }
  return links;
};

export const parsePnpmLockPackageVersions = (
  yamlString: string,
  pnpmLockPath?: string,
): PnpmLockVersionMap | PacwichError => {
  const parsed = parsePnpmLock(yamlString, pnpmLockPath);
  if (parsed instanceof Error) return parsed as PacwichError;

  const versions: PnpmLockVersionMap = new Map();
  for (const key of Object.keys(parsed.packages)) {
    // Strip the optional peer-disambiguation tail: `name@1.2.3(peer@1)`
    // → `name@1.2.3`. The first `(` is always after the version segment.
    const cleanKey = key.split("(", 1)[0];
    const lastAt = cleanKey.lastIndexOf("@");
    if (lastAt <= 0) continue;
    const name = cleanKey.slice(0, lastAt);
    const version = cleanKey.slice(lastAt + 1);
    if (!name || !version) continue;
    // Earlier entry wins for stability. Duplicates only happen for the
    // same name@version with different peer hashes, so the resolved
    // version segment is identical.
    if (!versions.has(name)) versions.set(name, version);
  }
  return versions;
};
