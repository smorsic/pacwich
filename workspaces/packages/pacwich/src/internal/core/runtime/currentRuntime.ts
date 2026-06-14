import { getToolEndUserVersion } from "@pacwich/common";
import semver from "../../bundledDeps/semver";
import { defineErrors } from "../error";

/** Errors and warnings surfaced when the active JS runtime is
 * outside pacwich's supported range, or is neither Bun nor Node.
 * Subclasses of {@link PacwichError}. Today these are logged as
 * warnings rather than thrown, but the classes are stable so callers
 * can match on them programmatically. */
export const RUNTIME_ERRORS = defineErrors(
  "UnsupportedBunVersion",
  "UnsupportedNodeVersion",
  "UnsupportedRuntime",
);

export const IS_BUN = typeof Bun !== "undefined";

export const IS_NODE =
  !IS_BUN &&
  typeof process !== "undefined" &&
  process.versions?.node !== undefined;

export const IS_UNSUPPORTED_RUNTIME = !IS_BUN && !IS_NODE;

export const validateBunVersion = (version: string) => {
  const requiredVersion = getToolEndUserVersion("bun");
  if (!semver.satisfies(version, requiredVersion)) {
    return new RUNTIME_ERRORS.UnsupportedBunVersion(
      `Bun version ${version} is not supported. Required version: ${requiredVersion}`,
    );
  }
};

export const validateNodeVersion = (version: string) => {
  const requiredVersion = getToolEndUserVersion("node");
  if (!semver.satisfies(version, requiredVersion)) {
    return new RUNTIME_ERRORS.UnsupportedNodeVersion(
      `Node version ${version} is not supported. Required version: ${requiredVersion}`,
    );
  }
};

export const validateRuntime = () => {
  if (IS_BUN) {
    return validateBunVersion(Bun.version);
  }

  if (IS_NODE) {
    return validateNodeVersion(process.versions.node);
  }

  return new RUNTIME_ERRORS.UnsupportedRuntime(
    "Unsupported runtime. Only Bun and Node.js are supported.",
  );
};

export const CURRENT_RUNTIME_INFO = {
  name: IS_BUN ? "bun" : IS_NODE ? "node" : "unsupported",
  version: IS_BUN ? Bun.version_with_sha : IS_NODE ? process.versions.node : "",
} as const;

export type CurrentRuntimeInfo = typeof CURRENT_RUNTIME_INFO;

export type CurrentRuntimeName = CurrentRuntimeInfo["name"];
