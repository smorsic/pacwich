import { execFileSync } from "child_process";
import { getToolEndUserVersion } from "@pacwich/common";
import semver from "../internal/bundledDeps/semver";
import { defineErrors, type PacwichError } from "../internal/core";
import type { PackageManagerName } from "./adapter";

export const PACKAGE_MANAGER_VERSION_ERRORS = defineErrors(
  "UnsupportedPnpmVersion",
);

const VERSION_CACHE = new Map<string, string>();
const DETECTION_TIMEOUT_MS = 5_000;

const detectViaShellSync = (binary: string): string => {
  const cached = VERSION_CACHE.get(binary);
  if (cached !== undefined) return cached;
  let result = "";
  try {
    const stdout = execFileSync(binary, ["--version"], {
      timeout: DETECTION_TIMEOUT_MS,
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
    });
    result = stdout.toString().trim();
  } catch {
    result = "";
  }
  VERSION_CACHE.set(binary, result);
  return result;
};

/**
 * For tests to reset the cache.
 */
export const __resetPackageManagerVersionCache = () => {
  VERSION_CACHE.clear();
};

export const validatePnpmVersion = (
  version: string = detectViaShellSync("pnpm"),
): PacwichError | undefined => {
  if (!version) return undefined;
  const requiredVersion = getToolEndUserVersion("pnpm");
  if (!semver.satisfies(version, requiredVersion)) {
    return new PACKAGE_MANAGER_VERSION_ERRORS.UnsupportedPnpmVersion(
      `pnpm version ${version} is not supported. Required version: ${requiredVersion}`,
    );
  }
  return undefined;
};

const VALIDATORS: Record<PackageManagerName, () => PacwichError | undefined> = {
  bun: () => undefined,
  npm: () => undefined,
  pnpm: () => validatePnpmVersion(),
};

/**
 * Run the version validator for a backend. Currently only pnpm has a
 * tooling-version check here. Bun and node go through
 * `validateRuntime` (since they're the runtimes too), and npm doesn't
 * have a declared supported range. The dispatch keeps the call site
 * uniform so future backends can plug in without conditionals.
 */
export const validatePackageManagerVersion = (
  name: PackageManagerName,
): PacwichError | undefined => VALIDATORS[name]();
