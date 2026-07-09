import fs from "fs";
import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import {
  type PacwichError,
  defineErrors,
  parseJSONC,
} from "../../../../internal/core";
import { logger } from "../../../../internal/logger";

/** Errors thrown while reading and parsing `bun.lock` for the bun
 * backend. Concrete classes map to abstract names on
 * `PackageManagerAdapter.errors`. Subclasses of
 * {@link PacwichError}. */
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

/**
 * bun.lock has reported `lockfileVersion: 1` since the text lockfile
 * landed, so MIN and MAX are both 1 today. A newer file is parsed
 * leniently (warn + treat as MAX); the structural guards in
 * {@link parseBunLock} remain the real safety net. Versions below MIN
 * are rejected as unsupported.
 *
 * FUTURE: once bun ships a v2+ that we support, MIN and MAX diverge and
 * the "Supported" message below should render as a range
 * (`>=MIN <=MAX`) like the pnpm backend does.
 */
export const MIN_SUPPORTED_BUN_LOCK_VERSION = 1;
export const MAX_SUPPORTED_BUN_LOCK_VERSION = 1;

export const parseBunLock = (
  jsonString: string,
  /** Only for error message */
  bunLockPath?: string,
): RelevantBunLock | PacwichError => {
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

  const { lockfileVersion } = bunLockJson;

  // Validate type first, so a missing or non-numeric version is treated
  // as malformed rather than as an unsupported version.
  if (typeof lockfileVersion !== "number") {
    return new BUN_LOCK_ERRORS.MalformedBunLock(
      `Bun lockfile ${
        bunLockPath ? `at "${bunLockPath}"` : ""
      } has an invalid lockfileVersion field of type ${typeof lockfileVersion}: ${
        lockfileVersion ?? "(could not find property lockfileVersion)"
      }`,
    );
  }

  // Strict low: versions older than we understand have a different
  // shape whose data we can't reconstruct, so reject them.
  if (lockfileVersion < MIN_SUPPORTED_BUN_LOCK_VERSION) {
    return new BUN_LOCK_ERRORS.UnsupportedBunLockVersion(
      `Unsupported bun lockfile version ${bunLockPath ? `at "${bunLockPath}"` : ""}: ${lockfileVersion} (Supported: ${MAX_SUPPORTED_BUN_LOCK_VERSION})`,
    );
  }

  // Lenient high: a newer format is probably still compatible for the
  // fields we read. Warn and parse it as the newest version we know;
  // the structural guards below catch anything actually incompatible.
  if (lockfileVersion > MAX_SUPPORTED_BUN_LOCK_VERSION) {
    logger.warn("BunLockNewerVersion", {
      atPath: bunLockPath ? ` at "${bunLockPath}"` : "",
      version: String(lockfileVersion),
      maxVersion: String(MAX_SUPPORTED_BUN_LOCK_VERSION),
    });
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
    // Clamp so any future version-branched logic treats a newer file as
    // the newest version we understand.
    lockfileVersion: Math.min(lockfileVersion, MAX_SUPPORTED_BUN_LOCK_VERSION),
    workspaces: bunLockJson.workspaces ?? {},
  };
};

export const readBunLockfile = (
  directory: string,
): RelevantBunLock | PacwichError => {
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
 * skipped. Version comparison only makes sense for registry-resolved deps.
 */
export type BunLockVersionMap = Map<string, string>;

const VERSION_SEPARATOR = "@";

const BUN_WORKSPACE_RESOLUTION = "@workspace:";

/**
 * Set of dependency names that `bun.lock` records as resolving to a
 * local workspace. bun hoists workspace entries into the top-level
 * `packages` block, where the resolution string takes the form
 * `<name>@workspace:<path>` (e.g. `pkg-a@workspace:packages/a`). The
 * set is per-name (independent of the consuming workspace): bun links a
 * name project-wide or errors the install before a lockfile is written.
 */
export const parseBunLockWorkspaceLinkNames = (
  jsonString: string,
  bunLockPath?: string,
): Set<string> | PacwichError => {
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

  const names = new Set<string>();
  const packages = bunLockJson.packages;
  if (!isJSONObject(packages)) return names;
  for (const [name, entry] of Object.entries(packages)) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    if (entry[0].includes(BUN_WORKSPACE_RESOLUTION)) names.add(name);
  }
  return names;
};

export const parseBunLockPackageVersions = (
  jsonString: string,
  bunLockPath?: string,
): BunLockVersionMap | PacwichError => {
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
    // pseudo-version. Skip those, we only track real registry-resolved versions.
    if (version.startsWith("workspace:")) continue;
    versions.set(name, version);
  }

  return versions;
};
