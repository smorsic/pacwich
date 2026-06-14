import {
  type WorkspaceConfig,
  type ResolvedWorkspaceConfig,
} from "@pacwich/common/config";
import { resolveOptionalArray } from "../../internal/core";
import _validate from "../../internal/generated/ajv/validateWorkspaceConfig";
import type { AjvSchemaValidator } from "../util/ajvTypes";
import { executeValidator } from "../util/validateConfig";
import { WORKSPACE_CONFIG_ERRORS } from "./errors";

const validate = _validate as unknown as AjvSchemaValidator<WorkspaceConfig>;

export const validateWorkspaceConfig = (config: WorkspaceConfig) => {
  executeValidator(
    validate as unknown as AjvSchemaValidator<WorkspaceConfig>,
    "WorkspaceConfig",
    {
      ...config,
    },
    WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig,
  );
};

export const resolveWorkspaceConfig = (
  config: WorkspaceConfig,
): ResolvedWorkspaceConfig => {
  if (Array.isArray((config as ResolvedWorkspaceConfig).aliases)) {
    const { aliases, ...rest } = config as ResolvedWorkspaceConfig;
    validateWorkspaceConfig({
      ...rest,
      alias: aliases,
    });
    return {
      aliases,
      ...rest,
    };
  }

  validateWorkspaceConfig(config);

  return {
    aliases: resolveOptionalArray(config.alias ?? []),
    tags: config.tags ?? [],
    scripts: config.scripts ?? {},
    rules: config.rules ?? {},
    ...(config.defaultInputs && { defaultInputs: config.defaultInputs }),
  };
};

export const createDefaultWorkspaceConfig = (): ResolvedWorkspaceConfig =>
  resolveWorkspaceConfig({});
