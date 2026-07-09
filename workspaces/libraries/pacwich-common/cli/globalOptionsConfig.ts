import { getUserEnvVarName } from "../config";
import { LOG_LEVELS, type LogLevelSetting } from "../logging";
import {
  PACKAGE_MANAGER_VALUES,
  type PackageManagerValue,
} from "../parameters";
import { formatWarningPrefix } from "../warnings";

export interface CliGlobalOptions {
  logLevel: LogLevelSetting;
  cwd: string;
  includeRoot: boolean;
  disableExecutableConfigs: boolean;
  pm: PackageManagerValue | undefined;
  /** Comma-separated warning ids */
  suppressWarnings: string | undefined;
}

export interface CliGlobalOptionConfig {
  mainOption: string;
  shortOption: string;
  description: string;
  defaultValue: string;
  values: string[] | null;
  param: string;
}

const CLI_GLOBAL_OPTIONS_CONFIG = {
  logLevel: {
    mainOption: "--log-level",
    shortOption: "-l",
    description: "Log levels",
    defaultValue: "info",
    values: [...LOG_LEVELS, "silent"] satisfies LogLevelSetting[],
    param: "level",
  },
  cwd: {
    mainOption: "--cwd",
    shortOption: "-d",
    description: "Working directory",
    defaultValue: "",
    values: null,
    param: "path",
  },
  includeRoot: {
    mainOption: "--include-root",
    shortOption: "-r",
    description: "Include the root workspace as a normal workspace",
    defaultValue: "",
    values: null,
    param: "",
  },
  disableExecutableConfigs: {
    mainOption: "--disable-executable-configs",
    shortOption: "",
    description: `Skip evaluating executable config files (pacwich.project.{ts,js}, pacwich.workspace.{ts,js}). Only jsonc/json/package.json configs are read, for untrusted contexts. Can also be set via env var ${getUserEnvVarName("disableExecutableConfigsDefault")}=true.`,
    defaultValue: "",
    values: null,
    param: "",
  },
  pm: {
    mainOption: "--pm",
    shortOption: "",
    description: `Package manager backend. Overrides the project config "packageManager" field and the ${getUserEnvVarName("packageManager")} env var. "auto" picks a backend from the lockfiles in the project root.`,
    defaultValue: "",
    values: [...PACKAGE_MANAGER_VALUES],
    param: "value",
  },
  suppressWarnings: {
    mainOption: "--suppress-warnings",
    shortOption: "",
    description: `Comma-separated warning ids to suppress. A warning's id appears in its printed "${formatWarningPrefix("pacwich", "<id>")}" prefix. Combined with the ${getUserEnvVarName("suppressWarnings")} env var.`,
    defaultValue: "",
    values: null,
    param: "ids",
  },
} as const satisfies Record<keyof CliGlobalOptions, CliGlobalOptionConfig>;

export type CliGlobalOptionName = keyof CliGlobalOptions;

export const getCliGlobalOptionConfig = (optionName: CliGlobalOptionName) =>
  CLI_GLOBAL_OPTIONS_CONFIG[optionName];

export const getCliGlobalOptionNames = () =>
  Object.keys(CLI_GLOBAL_OPTIONS_CONFIG) as CliGlobalOptionName[];
