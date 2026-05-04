export const USER_ENV_VARS = {
  parallelMaxDefault: "BW_PARALLEL_MAX_DEFAULT",
  scriptShellDefault: "BW_SHELL_DEFAULT",
  includeRootWorkspaceDefault: "BW_INCLUDE_ROOT_WORKSPACE_DEFAULT",
  affectedBaseRefDefault: "BW_AFFECTED_BASE_REF_DEFAULT",
} as const;

export type UserEnvVarName = keyof typeof USER_ENV_VARS;

export const getUserEnvVarName = (key: UserEnvVarName) => USER_ENV_VARS[key];
