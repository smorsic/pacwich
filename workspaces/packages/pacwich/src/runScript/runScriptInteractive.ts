import type { ScriptShellOption } from "@pacwich/common/parameters";
import type { ScriptCommand } from "../packageManager/adapter";
import type { RunScriptExit } from "./runScript";
import { createScriptExecutor } from "./scriptExecution";
import { resolveRunScriptExit } from "./scriptExit";
import { createSubprocess } from "./subprocesses";

export type RunScriptInteractiveOptions<
  ScriptMetadata extends object = object,
> = {
  scriptCommand: ScriptCommand;
  metadata: ScriptMetadata;
  env: Record<string, string>;
  /** The shell to use to run the script. Defaults to "system". */
  shell?: ScriptShellOption;
};

export type RunScriptInteractiveResult<ScriptMetadata extends object = object> =
  {
    exit: Promise<RunScriptExit<ScriptMetadata>>;
    metadata: ScriptMetadata;
    kill: (exit?: number | NodeJS.Signals) => void;
  };

/**
 * Run a script with the parent process's stdio inherited directly, so
 * the child reads/writes the controlling terminal. Used for interactive
 * scripts (prompts, REPLs, dev servers). No output can be captured here.
 */
export const runScriptInteractive = <ScriptMetadata extends object = object>({
  scriptCommand,
  metadata,
  env,
  shell = "system",
}: RunScriptInteractiveOptions<ScriptMetadata>): RunScriptInteractiveResult<ScriptMetadata> => {
  const startTime = new Date();

  const { argv, cleanup } = createScriptExecutor(scriptCommand.command, shell);

  const proc = createSubprocess(argv, {
    cwd: scriptCommand.workingDirectory || process.cwd(),
    env: {
      ...process.env,
      ...env,
      _PACWICH_SCRIPT_SHELL_OPTION: shell,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    detached: false,
  });

  proc.exited.finally(cleanup);

  const exit = resolveRunScriptExit({ proc, startTime, metadata });

  return {
    exit,
    metadata,
    kill: (exit) => proc.kill(exit),
  };
};
