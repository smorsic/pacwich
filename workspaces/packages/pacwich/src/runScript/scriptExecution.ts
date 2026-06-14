import type { ScriptShellOption } from "@pacwich/common/parameters";
import {
  PacwichError,
  createShortId,
  defineErrors,
  DEFAULT_TEMP_DIR,
  IS_WINDOWS,
} from "../internal/core";
import { shellAvailability } from "./scriptShellAvailability";
import { resolveScriptShell } from "./scriptShellOption";

/** Errors thrown before subprocess spawn when the requested shell is
 * unavailable (currently: the Bun shell selected on a host without
 * Bun installed). Subclass of {@link PacwichError}. */
export const SCRIPT_SHELL_ERRORS = defineErrors("BunShellUnavailable");

const createWindowsBatchFile = (command: string) => {
  const fileName = `${createShortId(6)}.cmd`;

  const fileContent = `@echo off\r\n${command}\r\n`;

  return DEFAULT_TEMP_DIR.createFile({ name: fileName, content: fileContent });
};

const createShellScript = (command: string) => {
  const fileName = `${createShortId(6)}.sh`;

  return DEFAULT_TEMP_DIR.createFile({
    name: fileName,
    content: command,
    mode: 0o700,
  });
};

export type ScriptExecutor = {
  argv: string[];
  cleanup: () => void;
};

export const createScriptExecutor = (
  command: string,
  shell: ScriptShellOption,
): ScriptExecutor => {
  shell = resolveScriptShell(shell);

  if (shell === "bun") {
    if (!shellAvailability.isBunAvailable()) {
      throw new SCRIPT_SHELL_ERRORS.BunShellUnavailable(
        `The Bun shell is requested but Bun is not installed on this machine. Install Bun (https://bun.com) or set the shell to "system".`,
      );
    }
    const { filePath, cleanup } = createShellScript(command);
    return {
      argv: ["bun", filePath],
      cleanup,
    };
  }

  if (shell === "system") {
    const { filePath, cleanup } = IS_WINDOWS
      ? createWindowsBatchFile(command)
      : createShellScript(command);

    return {
      argv: IS_WINDOWS
        ? ["cmd", "/d", "/s", "/c", "call", filePath]
        : ["sh", "-c", filePath],
      cleanup,
    };
  }

  throw new PacwichError(`Invalid shell option: ${shell}`);
};
