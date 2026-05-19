import { IS_WINDOWS, runOnExit } from "../internal/core";
import { logger } from "../internal/logger";

const SUBPROCESS_REGISTRY: Record<number, Bun.Subprocess> = {};

/**
 * Kill a tracked subprocess together with any descendants it has spawned.
 *
 * On POSIX, subprocesses are spawned with `detached: true`, which makes each
 * child the leader of its own process group (pgid === pid). Signalling
 * `-pid` therefore delivers the signal to every descendant in that group,
 * not just the direct child. This is required for the common case of a
 * shell wrapping a temp script: a plain `subprocess.kill()` only reaches
 * the shell, leaving any grandchild (e.g. `bun build`) orphaned and
 * reparented to init when the shell exits.
 *
 * On Windows there's no equivalent process-group semantics, so we fall back
 * to a direct kill via the Bun.Subprocess handle.
 */
export const killSubprocessTree = (
  subprocess: Bun.Subprocess,
  signal: NodeJS.Signals | number,
) => {
  if (IS_WINDOWS) {
    subprocess.kill(signal);
    return;
  }

  try {
    process.kill(-subprocess.pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return;
    if (code === "EPERM") {
      try {
        subprocess.kill(signal);
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

runOnExit((codeOrSignal) => {
  Object.values(SUBPROCESS_REGISTRY).forEach((subprocess) => {
    /**
     * @todo Windows support for killing subprocesses is needed.
     * subprocess.kill() will throw with not-implemented error
     */
    if (!subprocess.killed && subprocess.exitCode === null && !IS_WINDOWS) {
      const signal =
        typeof codeOrSignal === "string" ? codeOrSignal : "SIGTERM";
      logger.debug(
        `Killing subprocess ${subprocess.pid} with signal ${signal}`,
      );
      killSubprocessTree(subprocess, signal);
    }
  });
});

/**Essentially a wrapper around `Bun.spawn` that ensures all
 * the subprocess is killed when the main process exits for any
 * handle-able exit code or signal. */
export const createSubprocess = <
  In extends Bun.SpawnOptions.Writable,
  Out extends Bun.SpawnOptions.Readable,
  Err extends Bun.SpawnOptions.Readable,
>(
  argv: string[],
  options: Bun.Spawn.SpawnOptions<In, Out, Err>,
): Bun.Subprocess<In, Out, Err> => {
  const subprocess = Bun.spawn(argv, {
    ...options,
    // On POSIX, each tracked subprocess becomes the leader of its own
    // process group so the registry can kill its full descendant tree via
    // `process.kill(-pid, signal)` (see killSubprocessTree). Scoping the
    // kill per child keeps the blast radius off the parent's process group,
    // which matters when bun-workspaces is loaded inside another runner
    // (e.g. a vitest worker) that shares our pgid.
    ...(IS_WINDOWS ? {} : { detached: true }),
  });

  logger.debug(`Subprocess spawned with pid ${subprocess.pid}`);

  SUBPROCESS_REGISTRY[subprocess.pid] = subprocess;

  subprocess.exited.finally(() => {
    delete SUBPROCESS_REGISTRY[subprocess.pid];
  });

  return subprocess;
};
