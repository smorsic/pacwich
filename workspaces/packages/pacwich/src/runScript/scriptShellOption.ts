import { getUserEnvVarName } from "@pacwich/common/config";
import {
  SCRIPT_SHELL_OPTIONS,
  type ScriptShellOption,
} from "@pacwich/common/parameters";
import { getUserEnvVar } from "../config/userEnvVars";
import { PacwichError } from "../internal/core/error";

export const validateScriptShellOption = (
  shell: string,
  fromEnvVar = false,
): ScriptShellOption => {
  if (!SCRIPT_SHELL_OPTIONS.includes(shell as ScriptShellOption)) {
    throw new PacwichError(
      `Invalid shell option: ${shell} (accepted values: ${SCRIPT_SHELL_OPTIONS.join(", ")})${fromEnvVar ? ` (set by env var ${getUserEnvVarName("scriptShellDefault")})` : ""}`,
    );
  }
  return shell as ScriptShellOption;
};

export const getScriptShellDefault = () => {
  const shell = getUserEnvVar("scriptShellDefault");

  return shell ? validateScriptShellOption(shell, true) : "system";
};

export const resolveScriptShell = (shell?: string): ScriptShellOption => {
  if (
    !shell ||
    shell === "default" ||
    shell === "undefined" ||
    shell === "null"
  ) {
    return getScriptShellDefault();
  }
  return validateScriptShellOption(shell);
};
