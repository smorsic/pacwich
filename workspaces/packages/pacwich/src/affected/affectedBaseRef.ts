import { getUserEnvVar } from "../config/userEnvVars";

export const DEFAULT_AFFECTED_BASE_REF = "main";

/**
 * Resolves the default base ref for affected workspace resolution.
 *
 * Precedence: explicit value (typically from project config defaults) >
 * `PACWICH_AFFECTED_BASE_REF_DEFAULT` env var > `"main"`.
 */
export const resolveDefaultAffectedBaseRef = (value?: string): string =>
  value || getUserEnvVar("affectedBaseRefDefault") || DEFAULT_AFFECTED_BASE_REF;
