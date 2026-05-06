import fs from "fs";
import path from "path";
import { isJSONObject } from "bw-common/types";
import { type BunWorkspacesError, defineErrors, parseJSONC } from "../core";

export const BUN_LOCK_ERRORS = defineErrors(
  "BunLockNotFound",
  "MalformedBunLock",
  "UnsupportedBunLockVersion",
);

export type RelevantBunLockWorkspace = {
  name: string;
};

export type RelevantBunLock = {
  lockfileVersion: number;
  workspaces: Record<string, RelevantBunLockWorkspace>;
};

export const SUPPORTED_BUN_LOCK_VERSIONS = [1] as const;

export const parseBunLock = (
  jsonString: string,
  /** Only for error message */
  bunLockPath?: string,
): RelevantBunLock | BunWorkspacesError => {
  let bunLockJson: RelevantBunLock | null = null;
  try {
    bunLockJson = parseJSONC(jsonString);
  } catch (error) {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Failed to parse bun lockfile ${bunLockPath ? `at "${bunLockPath}"` : ""}: ${
        (error as Error).message
      }`,
    );
  }

  if (!isJSONObject(bunLockJson)) {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Bun lockfile ${bunLockPath ? `at "${bunLockPath}"` : ""} is not a valid JSON object`,
    );
  }

  if (bunLockJson.lockfileVersion !== SUPPORTED_BUN_LOCK_VERSIONS[0]) {
    return new BUN_LOCK_ERRORS.UnsupportedBunLockVersion(
      `Unsupported bun lockfile version ${bunLockPath ? `at "${bunLockPath}"` : ""}: ${
        bunLockJson.lockfileVersion ??
        "(could not find property lockfileVersion)"
      } (Supported: ${SUPPORTED_BUN_LOCK_VERSIONS.join(", ")})`,
    );
  }

  if (typeof bunLockJson.lockfileVersion !== "number") {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Bun lockfile ${
        bunLockPath ? `at "${bunLockPath}"` : ""
      } has an invalid lockfileVersion field of type ${typeof bunLockJson.lockfileVersion}: ${
        bunLockJson.lockfileVersion
      }`,
    );
  }

  if (bunLockJson.workspaces && typeof bunLockJson.workspaces !== "object") {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Bun lockfile ${
        bunLockPath ? `at "${bunLockPath}"` : ""
      } has an invalid workspaces field of type ${typeof bunLockJson.workspaces}: ${
        bunLockJson.workspaces
      }`,
    );
  }

  return {
    lockfileVersion: bunLockJson.lockfileVersion,
    workspaces: bunLockJson.workspaces ?? {},
  };
};

export const readBunLockfile = (
  directory: string,
): RelevantBunLock | BunWorkspacesError => {
  const bunLockPath = path.join(
    directory.replace(/(\/*)?bun.lock$/, ""),
    "bun.lock",
  );
  if (!fs.existsSync(bunLockPath)) {
    return new BUN_LOCK_ERRORS.BunLockNotFound(
      `Did not find bun lockfile at "${bunLockPath}"`,
    );
  }

  const jsonString = fs.readFileSync(bunLockPath, "utf8");

  return parseBunLock(jsonString, bunLockPath);
};

/**
 * Map of package name → resolved version string from `bun.lock`'s
 * `packages` field.
 *
 * `bun.lock`'s `packages` object has entries shaped like:
 *   `"<name>": ["<name>@<version>", ...metadata]`
 * The first array element carries the resolved version. We extract the
 * portion after the LAST `@` to handle scoped names like
 * `"@scope/foo": ["@scope/foo@1.2.3", ...]`.
 *
 * Names whose resolved entry doesn't follow `name@version` (e.g. workspace
 * placeholders, git/url specs that don't expose a version segment) are
 * skipped — version comparison only makes sense for registry-resolved deps.
 */
export type BunLockVersionMap = Map<string, string>;

const VERSION_SEPARATOR = "@";

export const parseBunLockPackageVersions = (
  jsonString: string,
  bunLockPath?: string,
): BunLockVersionMap | BunWorkspacesError => {
  let bunLockJson: { packages?: unknown } | null = null;
  try {
    bunLockJson = parseJSONC(jsonString);
  } catch (error) {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Failed to parse bun lockfile ${bunLockPath ? `at "${bunLockPath}"` : ""}: ${
        (error as Error).message
      }`,
    );
  }

  if (!isJSONObject(bunLockJson)) {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Bun lockfile ${bunLockPath ? `at "${bunLockPath}"` : ""} is not a valid JSON object`,
    );
  }

  const versions: BunLockVersionMap = new Map();
  const packages = bunLockJson.packages;
  if (!isJSONObject(packages)) return versions;

  for (const [name, entry] of Object.entries(packages)) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    const head = entry[0];
    const lastAt = head.lastIndexOf(VERSION_SEPARATOR);
    if (lastAt <= 0) continue;
    const version = head.slice(lastAt + 1);
    if (!version) continue;
    // bun.lock entries for workspace packages carry a `workspace:<path>`
    // pseudo-version. Skip — we only track real registry-resolved versions.
    if (version.startsWith("workspace:")) continue;
    versions.set(name, version);
  }

  return versions;
};
