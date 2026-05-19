import type { ScriptShellOption } from "bw-common/parameters";
import {
  createProcessOutput,
  createMultiProcessOutput,
  type MultiProcessOutput,
  type OutputStreamName,
} from "./output";
import type { ScriptCommand } from "./scriptCommand";
import { createScriptExecutor } from "./scriptExecution";
import { createSubprocess, killSubprocessTree } from "./subprocesses";

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

const SIGNAL_MAP = {
  130: "SIGINT",
  143: "SIGTERM",
  129: "SIGHUP",
  131: "SIGQUIT",
  138: "SIGUSR1",
  140: "SIGUSR2",
} as const;

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
      _BW_SCRIPT_SHELL_OPTION: shell,
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

  const exit = proc.exited.then<RunScriptExit<ScriptMetadata>>((exitCode) => {
    const endTime = new Date();
    return {
      exitCode,
      signal:
        proc.signalCode ??
        SIGNAL_MAP[exitCode as keyof typeof SIGNAL_MAP] ??
        null,
      success: exitCode === 0,
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
      metadata,
    };
  });

  return {
    output: processOutput,
    exit,
    metadata,
    kill: (exit) => killSubprocessTree(proc, exit ?? "SIGTERM"),
  };
};
