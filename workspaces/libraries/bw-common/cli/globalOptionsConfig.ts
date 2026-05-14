import { LOG_LEVELS, type LogLevelSetting } from "../logging";

export interface CliGlobalOptions {
  logLevel: LogLevelSetting;
  cwd: string;
  includeRoot: boolean;
  workspaceRoot: boolean;
  disableExecutableConfigs: boolean;
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
  workspaceRoot: {
    mainOption: "--workspace-root",
    shortOption: "-w",
    description:
      "Run from the project root above the current working directory",
    defaultValue: "",
    values: null,
    param: "",
  },
  disableExecutableConfigs: {
    mainOption: "--disable-executable-configs",
    shortOption: "",
    description:
      "Skip evaluating executable config files (bw.root.{ts,js}, bw.workspace.{ts,js}); only jsonc/json/package.json configs are read. Defaults to off for most commands and on for mcp-server (use --no-disable-executable-configs to allow executable configs in mcp-server). Can also be set via the BW_DISABLE_EXECUTABLE_CONFIGS_DEFAULT env var (true|false).",
    defaultValue: "",
    values: null,
    param: "",
  },
} as const satisfies Record<keyof CliGlobalOptions, CliGlobalOptionConfig>;

export type CliGlobalOptionName = keyof CliGlobalOptions;

export const getCliGlobalOptionConfig = (optionName: CliGlobalOptionName) =>
  CLI_GLOBAL_OPTIONS_CONFIG[optionName];

export const getCliGlobalOptionNames = () =>
  Object.keys(CLI_GLOBAL_OPTIONS_CONFIG) as CliGlobalOptionName[];
