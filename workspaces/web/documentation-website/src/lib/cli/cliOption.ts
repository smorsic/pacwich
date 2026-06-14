import {
  type CliCommandConfig,
  type CliGlobalOptionConfig,
} from "@pacwich/common/cli";

export type CliExample = {
  bashLines: string[];
};

export type CliCommandInfo = {
  commandName: string;
  title: string;
  description: string;
  examples: string[];
  descriptionLinks?: {
    [key: string]: string;
  };
};

export type CliGlobalOptionInfo = {
  optionName: string;
  title: string;
  description: string;
  examples: string[];
};

export type CliCommandContent = CliCommandInfo & CliCommandConfig;

export type CliGlobalOptionContent = CliGlobalOptionInfo &
  CliGlobalOptionConfig;
