import { spawn, type SpawnOptions } from "child_process";
import os from "os";
import { type Readable, type Writable } from "stream";
import { IS_WINDOWS, runOnExit } from "../internal/core";
import { logger } from "../internal/logger";

export type SubprocessStdio = "pipe" | "ignore" | "inherit";

export type CreateSubprocessOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: SubprocessStdio;
  stdout?: SubprocessStdio;
  stderr?: SubprocessStdio;
};

export type Subprocess = {
  pid: number;
  readonly killed: boolean;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  stdout: Readable | null;
  stderr: Readable | null;
  stdin: Writable | null;
  exited: Promise<number>;
  kill: (signal?: number | NodeJS.Signals) => void;
};

const SUBPROCESS_REGISTRY: Record<number, Subprocess> = {};

runOnExit((codeOrSignal) => {
  Object.values(SUBPROCESS_REGISTRY).forEach((subprocess) => {
    /**
     * @todo Windows support for killing subprocesses is needed.
     * subprocess.kill() will throw with not-implemented error
     */
    if (!subprocess.killed && subprocess.exitCode === null && !IS_WINDOWS) {
      logger.debug(
        `Killing subprocess ${subprocess.pid} with signal ${codeOrSignal}`,
      );
      subprocess.kill(
        typeof codeOrSignal === "string" ? codeOrSignal : "SIGTERM",
      );
    }
  });
});

/**
 * Send `signal` to a child's process group so any grandchildren (e.g.
 * commands inside a temp shell script we spawned) die with it. Falls back
 * to signaling the child directly if the group lookup races with exit.
 */
const killProcessGroup = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return;
    if (code === "EPERM") {
      try {
        process.kill(pid, signal);
      } catch (innerError) {
        if ((innerError as NodeJS.ErrnoException).code !== "ESRCH") {
          throw innerError;
        }
      }
      return;
    }
    throw error;
  }
};

const SIGNAL_NUMBERS = os.constants.signals as Record<string, number>;

const resolveSignalExitCode = (signal: NodeJS.Signals | null): number => {
  if (!signal) return 1;
  const num = SIGNAL_NUMBERS[signal];
  return typeof num === "number" ? 128 + num : 1;
};

/**Wraps Node's `child_process.spawn` in a Bun.Subprocess-shaped object so
 * `runScript` consumers behave identically under both runtimes. Ensures
 * the subprocess is killed when the main process exits for any
 * handle-able exit code or signal (POSIX only). */
export const createSubprocess = (
  argv: string[],
  options: CreateSubprocessOptions,
): Subprocess => {
  const [command, ...args] = argv;

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: [
      options.stdin ?? "pipe",
      options.stdout ?? "pipe",
      options.stderr ?? "pipe",
    ],
    /**
     * Lead a fresh process group per child so grandchildren (e.g. commands
     * inside a temp shell script) can be reached via `kill(-pid)` on
     * shutdown. sh/bash doesn't forward SIGTERM to children, so signaling
     * the shell alone would orphan whatever it spawned.
     */
    detached: !IS_WINDOWS,
  } satisfies SpawnOptions);

  if (typeof child.pid !== "number") {
    throw new Error(`Failed to spawn subprocess: ${command} ${args.join(" ")}`);
  }

  logger.debug(`Subprocess spawned with pid ${child.pid}`);

  const exited = new Promise<number>((resolve) => {
    child.once("exit", (code, signal) => {
      resolve(code ?? resolveSignalExitCode(signal));
    });
    child.once("error", (err) => {
      logger.debug(`Subprocess error: ${err.message}`);
      resolve(1);
    });
  });

  const subprocess: Subprocess = {
    pid: child.pid,
    get killed() {
      return child.killed;
    },
    get exitCode() {
      return child.exitCode;
    },
    get signalCode() {
      return child.signalCode;
    },
    stdout: child.stdout,
    stderr: child.stderr,
    stdin: child.stdin,
    exited,
    kill: (signal) => {
      const resolvedSignal: NodeJS.Signals =
        typeof signal === "string" ? signal : "SIGTERM";
      if (IS_WINDOWS) {
        child.kill(signal as NodeJS.Signals | number | undefined);
        return;
      }
      killProcessGroup(child.pid as number, resolvedSignal);
    },
  };

  SUBPROCESS_REGISTRY[subprocess.pid] = subprocess;

  exited.finally(() => {
    delete SUBPROCESS_REGISTRY[subprocess.pid];
  });

  return subprocess;
};
