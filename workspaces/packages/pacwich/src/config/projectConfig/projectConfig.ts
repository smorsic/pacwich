import {
  type ProjectConfig,
  type ResolvedProjectConfig,
  type ResolvedProjectVerifyConfig,
  getUserEnvVarName,
} from "@pacwich/common/config";
import {
  OUTPUT_STYLE_VALUES,
  PACKAGE_MANAGER_VALUES,
  type OutputStyleName,
  type PackageManagerValue,
  type ParallelMaxValue,
} from "@pacwich/common/parameters";
import { resolveDefaultAffectedBaseRef } from "../../affected/affectedBaseRef";
import { validate } from "../../internal/generated/ajv/validateProjectConfig";
import { logger } from "../../internal/logger";
import {
  DEFAULT_OUTPUT_BUFFER_BYTES,
  determineParallelMax,
  parseOutputBufferBytes,
  resolveScriptShell,
} from "../../runScript";
import { getUserEnvVar } from "../userEnvVars";
import type { AjvSchemaValidator } from "../util/ajvTypes";
import { executeValidator } from "../util/validateConfig";
import { validateWorkspaceConfig } from "../workspaceConfig/workspaceConfig";
import { PROJECT_CONFIG_ERRORS } from "./errors";

export const validateProjectConfig = (config: ProjectConfig) =>
  executeValidator(
    validate as unknown as AjvSchemaValidator<ProjectConfig>,
    "ProjectConfig",
    config,
    PROJECT_CONFIG_ERRORS.InvalidProjectConfig,
  );

export const createDefaultProjectConfig = (): ResolvedProjectConfig =>
  resolveProjectConfig({});

const isPackageManagerValue = (value: string): value is PackageManagerValue =>
  (PACKAGE_MANAGER_VALUES as readonly string[]).includes(value);

const isOutputStyleName = (value: string): value is OutputStyleName =>
  (OUTPUT_STYLE_VALUES as readonly string[]).includes(value);

/**
 * Precedence for the resolved-config field: config value > env var >
 * `undefined`. Returning `undefined` signals to the CLI that the user
 * did not set a default, so it should derive one from terminal state.
 * The CLI's `--output-style` flag wins over this resolved field. That
 * override happens downstream of `resolveProjectConfig`. Env var values
 * outside {@link OUTPUT_STYLE_VALUES} are ignored with a warning
 * (config values are AJV-validated upstream).
 */
const resolveCliScriptOutputStyleConfigValue = (
  configValue: OutputStyleName | undefined,
): OutputStyleName | undefined => {
  if (configValue !== undefined) return configValue;
  const envValue = getUserEnvVar("cliScriptOutputStyleDefault");
  if (envValue === undefined) return undefined;
  if (isOutputStyleName(envValue)) return envValue;
  logger.warn(
    `Ignoring invalid PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT value ${JSON.stringify(
      envValue,
    )} (expected one of: ${OUTPUT_STYLE_VALUES.join(", ")}).`,
  );
  return undefined;
};

/**
 * Precedence for the resolved-config field: config value > env var >
 * `"auto"`. The CLI flag and project-factory option override this
 * downstream. They're applied after `resolveProjectConfig` returns.
 * Env var values that aren't in {@link PACKAGE_MANAGER_VALUES} are
 * ignored with a warning (config values are AJV-validated and so are
 * always trusted by the time they reach here).
 */
const resolvePackageManagerConfigValue = (
  configValue: PackageManagerValue | undefined,
): PackageManagerValue => {
  if (configValue !== undefined) return configValue;
  const envValue = getUserEnvVar("packageManager");
  if (envValue === undefined) return "auto";
  if (isPackageManagerValue(envValue)) return envValue;
  logger.warn(
    `Ignoring invalid PACWICH_PACKAGE_MANAGER value ${JSON.stringify(
      envValue,
    )} (expected one of: ${PACKAGE_MANAGER_VALUES.join(", ")}). Falling back to "auto".`,
  );
  return "auto";
};

/**
 * Precedence for the resolved cap: config value > env var >
 * {@link DEFAULT_OUTPUT_BUFFER_BYTES}. Accepts a byte count, a human size
 * (`"16MB"`), or `"unbounded"` (=> `Infinity`). Invalid env var values are
 * ignored with a warning and fall back to the default (config values are
 * AJV-validated for type but parsed here, so an invalid config string throws
 * upstream via `parseOutputBufferBytes`).
 */
const resolveMaxOutputBufferBytesConfigValue = (
  configValue: number | string | undefined,
): number => {
  if (configValue !== undefined) {
    return parseOutputBufferBytes(configValue, " (set by project config)");
  }
  const envValue = getUserEnvVar("outputBufferBytesDefault");
  if (envValue === undefined) return DEFAULT_OUTPUT_BUFFER_BYTES;
  try {
    return parseOutputBufferBytes(
      envValue,
      ` (set by env var ${getUserEnvVarName("outputBufferBytesDefault")})`,
    );
  } catch {
    logger.warn(
      `Ignoring invalid ${getUserEnvVarName(
        "outputBufferBytesDefault",
      )} value ${JSON.stringify(envValue)}. Falling back to the default.`,
    );
    return DEFAULT_OUTPUT_BUFFER_BYTES;
  }
};

const resolveProjectVerifyConfig = (
  config: ProjectConfig["verify"],
): ResolvedProjectVerifyConfig => ({
  workspaceDependencies: {
    ignoreInputFiles: config?.workspaceDependencies?.ignoreInputFiles ?? [],
  },
});

export const resolveProjectConfig = (
  config: ProjectConfig,
): ResolvedProjectConfig => {
  validateProjectConfig(config);

  for (const entry of config.workspacePatternConfigs ?? []) {
    if (typeof entry.config !== "function") {
      validateWorkspaceConfig(entry.config);
    }
  }

  return {
    packageManager: resolvePackageManagerConfigValue(config.packageManager),
    defaults: {
      parallelMax: determineParallelMax(
        (config.defaults?.parallelMax as ParallelMaxValue) ?? "default",
        " (set by project config)",
      ),
      shell: resolveScriptShell(config.defaults?.shell),
      includeRootWorkspace:
        config.defaults?.includeRootWorkspace ??
        getUserEnvVar("includeRootWorkspaceDefault") === "true",
      affectedBaseRef: resolveDefaultAffectedBaseRef(
        config.defaults?.affectedBaseRef,
      ),
      cliScriptOutputStyle: resolveCliScriptOutputStyleConfigValue(
        config.defaults?.cliScriptOutputStyle,
      ),
      maxOutputBufferBytes: resolveMaxOutputBufferBytesConfigValue(
        config.defaults?.maxOutputBufferBytes,
      ),
    },
    workspacePatternConfigs: config.workspacePatternConfigs ?? [],
    verify: resolveProjectVerifyConfig(config.verify),
  };
};
