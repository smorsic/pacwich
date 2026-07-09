export const USER_ENV_VARS = {
  parallelMaxDefault: "PACWICH_PARALLEL_MAX_DEFAULT",
  scriptShellDefault: "PACWICH_SHELL_DEFAULT",
  includeRootWorkspaceDefault: "PACWICH_INCLUDE_ROOT_WORKSPACE_DEFAULT",
  affectedBaseRefDefault: "PACWICH_AFFECTED_BASE_REF_DEFAULT",
  disableExecutableConfigsDefault: "PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT",
  packageManager: "PACWICH_PACKAGE_MANAGER",
  cliScriptOutputStyleDefault: "PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT",
  suppressWarningsDefault: "PACWICH_SUPPRESS_WARNINGS_DEFAULT",
} as const;

export type UserEnvVarName = keyof typeof USER_ENV_VARS;

export const getUserEnvVarName = <K extends UserEnvVarName>(key: K) =>
  USER_ENV_VARS[key];
