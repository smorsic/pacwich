import { logger } from "../../logger";

type ExitCodeOrSignal = NodeJS.Signals | number;
type ExitHandler = (exit?: ExitCodeOrSignal) => unknown;

let handlers: ExitHandler[] = [];
let listenersRegistered = false;

const runAllHandlers = (exit?: ExitCodeOrSignal) => {
  for (const handler of handlers) {
    try {
      handler(exit);
    } catch (error) {
      logger.error("Error running exit handler");
      logger.error(error as Error);
    }
  }
  logger.debug("Exit handlers ran");
  handlers = [];
};

const registerListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  logger.debug("Registering exit listeners");

  /**
   * No process.exit() here. Calling it re-entrantly during the exit
   * event preempts Node's own teardown, which silently swallows
   * uncaught exception reports and skips other exit listeners
   * registered by the host process.
   */
  process.on("exit", (code) => {
    runAllHandlers(code);
  });

  for (const signal of [
    "SIGINT",
    "SIGTERM",
    "SIGUSR1",
    "SIGUSR2",
    "SIGHUP",
    "SIGQUIT",
  ] satisfies NodeJS.Signals[]) {
    const handleSignal = () => {
      runAllHandlers(signal);
      process.off(signal, handleSignal);
      /**
       * Re-raise on self so the process exits with code 128+signum,
       * but only when no other listeners remain. If the host process
       * has its own handler, the exit decision is theirs (matching
       * runtime behavior as if pacwich weren't imported), and
       * re-raising would invoke their handler a second time.
       * We don't broadcast to the process group (kill(0, …)) because
       * that would also signal whoever launched us (e.g. a test
       * runner orchestrating workers), and the per-child cleanup in
       * the subprocess registry already takes the descendant tree
       * down via process-group kills.
       */
      if (process.listeners(signal).length === 0) {
        process.kill(process.pid, signal);
      }
    };
    process.on(signal, handleSignal);
  }
};

export const runOnExit = <F extends ExitHandler>(fn: F) => {
  registerListeners();
  let ran = false;

  const wrapped = (exit?: ExitCodeOrSignal) => {
    if (ran) return;
    ran = true;
    fn(exit);
    handlers = handlers.filter((handler) => handler !== wrapped);
  };

  handlers.push(wrapped);
};
