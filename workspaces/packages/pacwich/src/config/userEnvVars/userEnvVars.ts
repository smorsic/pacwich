import { USER_ENV_VARS, type UserEnvVarName } from "@pacwich/common/config";

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
