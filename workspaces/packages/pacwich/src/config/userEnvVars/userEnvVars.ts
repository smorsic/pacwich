import { USER_ENV_VARS, type UserEnvVarName } from "@pacwich/common/config";
import { splitCsvList } from "../../internal/core";

export const getUserEnvVar = (key: UserEnvVarName) =>
  process.env[USER_ENV_VARS[key]];

/**
 * Parse a user env var into a strict boolean tri-state. Returns `true` for
 * "true", `false` for "false", and `undefined` for any other value (including
 * unset), so callers can distinguish "user explicitly set false" from
 * "user did not set anything."
 */
export const getUserBoolEnvVar = (key: UserEnvVarName): boolean | undefined => {
  const value = getUserEnvVar(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

/**
 * Parse a user env var as a comma-separated list. Returns `undefined`
 * when unset, so callers can distinguish "empty list configured" from
 * "not configured at all."
 */
export const getUserListEnvVar = (
  key: UserEnvVarName,
): string[] | undefined => {
  const value = getUserEnvVar(key);
  if (value === undefined) return undefined;
  return splitCsvList(value);
};
