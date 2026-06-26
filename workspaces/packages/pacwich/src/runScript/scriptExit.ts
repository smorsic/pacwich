import type { RunScriptExit } from "./runScript";
import type { Subprocess } from "./subprocesses";

/**
 * Maps the conventional "128 + signal" exit codes back to their signal
 * name when the runtime didn't surface a `signalCode` directly (e.g. a
 * shell relaying a child's death by exit code rather than re-raising).
 */
const SIGNAL_MAP = {
  130: "SIGINT",
  143: "SIGTERM",
  129: "SIGHUP",
  131: "SIGQUIT",
  138: "SIGUSR1",
  140: "SIGUSR2",
} as const;

/**
 * Resolve a {@link RunScriptExit} from a finished (or finishing)
 * subprocess. Shared by the piped ({@link runScript}) and interactive
 * ({@link runScriptInteractive}) runners so both report identical
 * exit/signal/timing shapes.
 */
export const resolveRunScriptExit = <ScriptMetadata extends object>({
  proc,
  startTime,
  metadata,
}: {
  proc: Subprocess;
  startTime: Date;
  metadata: ScriptMetadata;
}): Promise<RunScriptExit<ScriptMetadata>> =>
  proc.exited.then<RunScriptExit<ScriptMetadata>>((exitCode) => {
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
