import { getUserEnvVarName } from "bw-common";
import {
  getCliGlobalOptionConfig,
  type CliGlobalOptionConfig,
  type CliGlobalOptionName,
} from "bw-common/cli";
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
      `bw ${mainOption}=/path/to/your/project list-workspaces`,
      `bw ${shortOption} /path/to/your/project list-workspaces`,
    ],
  })),
  workspaceRoot: defineOptionContent(
    "workspaceRoot",
    ({ mainOption, shortOption }) => ({
      title: "Run from Workspace Root",
      description:
        "Run from the project root when you are in a workspace subdirectory. This is similar to pnpm's -w option.",
      examples: [
        `cd packages/my-workspace`,
        "",
        "# Run from the project root",
        `bw ${mainOption} ls`,
        `bw ${shortOption} ls`,
        "",
        "# Similar to pnpm -w run",
        '# "@root" references the root package like a workspace',
        `bw ${shortOption} run my-root-script @root`,
      ],
    }),
  ),
  includeRoot: defineOptionContent(
    "includeRoot",
    ({ mainOption, shortOption }) => ({
      title: "Include Root",
      description:
        "Include the root workspace as a normal workspace. This overrides config and environment variable settings.",
      examples: [
        `bw ${mainOption} list-workspaces`,
        `bw ${shortOption} list-workspaces`,
        "",
        `bw ${mainOption.replace("--", "--no-")} list-workspaces # disable (to override config/env)`,
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
      examples: [`bw ${mainOption} list-workspaces`],
    }),
  ),
  logLevel: defineOptionContent("logLevel", ({ mainOption, shortOption }) => ({
    title: "Log Level",
    description:
      "Set the logging level. For the run-script (run) command, silence output with --output-style=none.",
    examples: [
      `bw ${mainOption}=debug list-workspaces`,
      `bw ${shortOption} error list-workspaces`,
    ],
  })),
} as const satisfies Record<CliGlobalOptionName, CliGlobalOptionContent>;

export const getCliGlobalOptionContent = (optionName: CliGlobalOptionName) =>
  CLI_GLOBAL_OPTIONS_CONTENT[optionName];

export const getCliGlobalOptionsContent = () =>
  Object.values(CLI_GLOBAL_OPTIONS_CONTENT);
