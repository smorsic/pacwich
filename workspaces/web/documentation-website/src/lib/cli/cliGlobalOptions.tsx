import { getUserEnvVarName } from "@pacwich/common";
import {
  getCliGlobalOptionConfig,
  type CliGlobalOptionConfig,
  type CliGlobalOptionName,
} from "@pacwich/common/cli";
import type { CliGlobalOptionContent, CliGlobalOptionInfo } from "./cliOption";

const defineOptionContent = (
  optionName: CliGlobalOptionName,
  factory: (
    optionConfig: CliGlobalOptionConfig,
  ) => Omit<CliGlobalOptionInfo, "optionName">,
): CliGlobalOptionContent => {
  const config = getCliGlobalOptionConfig(optionName);
  const content = factory(config);
  return {
    optionName,
    ...config,
    ...content,
  };
};

const CLI_GLOBAL_OPTIONS_CONTENT = {
  cwd: defineOptionContent("cwd", ({ mainOption, shortOption }) => ({
    title: "Working Directory",
    description:
      "Get the project root from a specific directory. This should be where the root package.json of your project is located.",
    examples: [
      `pacwich ${mainOption}=/path/to/your/project list-workspaces`,
      `pacwich ${shortOption} /path/to/your/project list-workspaces`,
    ],
  })),
  pm: defineOptionContent("pm", ({ mainOption }) => ({
    title: "Package Manager",
    description:
      "Expect a specific package manager. This overrides config and environment variable settings.",
    examples: [`pacwich ${mainOption}=pnpm list-workspaces`],
  })),
  includeRoot: defineOptionContent(
    "includeRoot",
    ({ mainOption, shortOption }) => ({
      title: "Include Root",
      description:
        "Include the root workspace as a normal workspace. This overrides config and environment variable settings.",
      examples: [
        `pacwich ${mainOption} list-workspaces`,
        `pacwich ${shortOption} list-workspaces`,
        "",
        `pacwich ${mainOption.replace("--", "--no-")} list-workspaces # disable (to override config/env)`,
      ],
    }),
  ),
  disableExecutableConfigs: defineOptionContent(
    "disableExecutableConfigs",
    ({ mainOption }) => ({
      title: "Disable Executable Configs",
      description:
        "Disable loading of executable config files (written in TS/JS) for untrusted contexts. " +
        `This can be set by default using the environment variable ${getUserEnvVarName("disableExecutableConfigsDefault")}=true.`,
      examples: [`pacwich ${mainOption} list-workspaces`],
    }),
  ),
  logLevel: defineOptionContent("logLevel", ({ mainOption, shortOption }) => ({
    title: "Log Level",
    description:
      "Set the logging level. For the run-script (run) command, silence output with --output-style=none. " +
      `A default can be set with the ${getUserEnvVarName("logLevel")} env var, which this flag overrides when passed.`,
    examples: [
      `pacwich ${mainOption}=debug list-workspaces`,
      `pacwich ${shortOption} error list-workspaces`,
    ],
  })),
  suppressWarnings: defineOptionContent(
    "suppressWarnings",
    ({ mainOption }) => ({
      title: "Suppress Warnings",
      description:
        "Suppress warning logs by id, in addition to the PACWICH_SUPPRESS_WARNINGS env var",
      examples: [
        `pacwich ${mainOption}=MissingWorkspacesHint,MultipleConfigsFound ls`,
      ],
    }),
  ),
} as const satisfies Record<CliGlobalOptionName, CliGlobalOptionContent>;

export const getCliGlobalOptionContent = (optionName: CliGlobalOptionName) =>
  CLI_GLOBAL_OPTIONS_CONTENT[optionName];

export const getCliGlobalOptionsContent = () =>
  Object.values(CLI_GLOBAL_OPTIONS_CONTENT);
