import type { ScriptShellOption } from "bw-common/parameters";
import {
  BunWorkspacesError,
  createShortId,
  DEFAULT_TEMP_DIR,
  IS_WINDOWS,
} from "../internal/core";
import { resolveScriptShell } from "./scriptShellOption";

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

  throw new BunWorkspacesError(`Invalid shell option: ${shell}`);
};
