import type { ScriptShellOption } from "@pacwich/common/parameters";
import type { ScriptCommand } from "../packageManager/adapter";
import {
  createProcessOutput,
  createMultiProcessOutput,
  type MultiProcessOutput,
  type OutputStreamName,
} from "./output";
import { createScriptExecutor } from "./scriptExecution";
import { resolveRunScriptExit } from "./scriptExit";
import { createSubprocess } from "./subprocesses";

/** The exit outcome of a single script run: status, signal, timing, and the run's metadata. */
export type RunScriptExit<ScriptMetadata extends object = object> = {
  exitCode: number;
  signal: NodeJS.Signals | null;
  success: boolean;
  /** Whether the script was skipped due to a failed dependency */
  skipped?: boolean;
  startTimeISO: string;
  endTimeISO: string;
  durationMs: number;
  metadata: ScriptMetadata;
};

export type RunScriptResult<ScriptMetadata extends object = object> = {
  output: MultiProcessOutput<ScriptMetadata & { streamName: OutputStreamName }>;
  exit: Promise<RunScriptExit<ScriptMetadata>>;
  metadata: ScriptMetadata;
  kill: (exit?: number | NodeJS.Signals) => void;
};

export type RunScriptOptions<ScriptMetadata extends object = object> = {
  scriptCommand: ScriptCommand;
  metadata: ScriptMetadata;
  env: Record<string, string>;
  /** The shell to use to run the script. Defaults to "system". */
  shell?: ScriptShellOption;
  /** Set to `true` to ignore all output from the script. This saves memory when you don't need script output. */
  ignoreOutput?: boolean;
};

/**
 * Run some script and get an async output stream of
 * stdout and stderr chunks and a result object
 * containing exit details.
 */
export const runScript = <ScriptMetadata extends object = object>({
  scriptCommand,
  metadata,
  env,
  shell = "system",
  ignoreOutput = false,
}: RunScriptOptions<ScriptMetadata>): RunScriptResult<ScriptMetadata> => {
  const startTime = new Date();

  const { argv, cleanup } = createScriptExecutor(scriptCommand.command, shell);

  const proc = createSubprocess(argv, {
    cwd: scriptCommand.workingDirectory || process.cwd(),
    env: {
      ...process.env,
      ...env,
      _PACWICH_SCRIPT_SHELL_OPTION: shell,
      FORCE_COLOR: "1",
    },
    stdout: ignoreOutput ? "ignore" : "pipe",
    stderr: ignoreOutput ? "ignore" : "pipe",
    stdin: "ignore",
  });

  proc.exited.finally(cleanup);

  const processOutput = createMultiProcessOutput<
    ScriptMetadata & { streamName: OutputStreamName }
  >([
    createProcessOutput(
      proc.stdout
        ? proc.stdout
        : (async function* () {
            /* empty */
          })(),
      { ...metadata, streamName: "stdout" },
    ),
    createProcessOutput(
      proc.stderr
        ? proc.stderr
        : (async function* () {
            /* empty */
          })(),
      { ...metadata, streamName: "stderr" },
    ),
  ]);

  const exit = resolveRunScriptExit({ proc, startTime, metadata });

  return {
    output: processOutput,
    exit,
    metadata,
    kill: (exit) => proc.kill(exit),
  };
};
