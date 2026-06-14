import fs from "fs";
import path from "path";
import { defineErrors } from "../../internal/core";
import { logger } from "../../internal/logger";
import {
  PACKAGE_MANAGER_NAMES,
  type PackageManagerName,
  type PackageManagerValue,
} from "./adapterTypes";

/**
 * Errors thrown by {@link resolvePackageManagerValue}. Thrown when
 * `"auto"` is selected and no lockfile is present, with no fallback
 * to a permanent default. Subclass of {@link PacwichError}.
 */
export const PACKAGE_MANAGER_VALUE_ERRORS = defineErrors(
  "PackageManagerAutoDetectFailed",
);

/**
 * Public reference for the auto-detection rules. Surfaced in the
 * ambiguity warning so users have a stable page to read when they need
 * to pin a backend explicitly.
 */
export const PACKAGE_MANAGER_DOCS_URL =
  "https://pacwich.dev/intro/getting-started#package-manager-selection";

/**
 * Project-relative lockfile path each backend owns. Used by
 * {@link resolvePackageManagerValue} when `value === "auto"`. The
 * order in {@link PACKAGE_MANAGER_NAMES} sets the deterministic
 * winner when two lockfiles are present (currently bun → pnpm → npm,
 * where pnpm wins over npm since it's the more explicit choice for
 * workspace projects).
 */
const PACKAGE_MANAGER_LOCKFILES: Record<PackageManagerName, string> = {
  bun: "bun.lock",
  pnpm: "pnpm-lock.yaml",
  npm: "package-lock.json",
};

export type ResolvePackageManagerValueOptions = {
  /** User-facing selector. Defaults to `"auto"` when not provided. */
  value?: PackageManagerValue;
  /** Project root used to probe lockfiles when `value === "auto"`. */
  rootDirectory: string;
};

const findLockfilePresentPms = (rootDirectory: string): PackageManagerName[] =>
  PACKAGE_MANAGER_NAMES.filter((name) =>
    fs.existsSync(path.join(rootDirectory, PACKAGE_MANAGER_LOCKFILES[name])),
  );

/**
 * Map a user-facing {@link PackageManagerValue} to a concrete
 * {@link PackageManagerName}.
 *
 * `"auto"` (the default) inspects lockfiles in `rootDirectory`
 */
export const resolvePackageManagerValue = ({
  value = "auto",
  rootDirectory,
}: ResolvePackageManagerValueOptions): PackageManagerName => {
  if (value !== "auto") return value;

  const present = findLockfilePresentPms(rootDirectory);

  if (present.length === 0) {
    throw new PACKAGE_MANAGER_VALUE_ERRORS.PackageManagerAutoDetectFailed(
      `Could not auto-detect a package manager at ${rootDirectory} (no lockfile present). ` +
        "Install dependencies to produce a lockfile (e.g. `bun install`, `pnpm install`, `npm install`), " +
        "or pin a package manager explicitly via the `packageManager` field in your project config, " +
        "the --pm CLI flag, or the PACWICH_PACKAGE_MANAGER env var. " +
        `See ${PACKAGE_MANAGER_DOCS_URL}.`,
    );
  }

  if (present.length === 1) {
    logger.debug(
      `Auto-detected package manager "${present[0]}" from ${PACKAGE_MANAGER_LOCKFILES[present[0]]}`,
    );
    return present[0];
  }

  const winner = present[0];
  logger.warn(
    `Multiple package manager lockfiles detected (${present
      .map((pm) => PACKAGE_MANAGER_LOCKFILES[pm])
      .join(
        ", ",
      )}). Picking "${winner}". Set "packageManager" explicitly (project config, --pm, or PACWICH_PACKAGE_MANAGER) to silence this. See ${PACKAGE_MANAGER_DOCS_URL}.`,
  );
  return winner;
};
