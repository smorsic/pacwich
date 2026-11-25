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
       * but only when no other listeners remain. This prevents
       * re-raising on a user's handler that could end up invoked twice.
       *
       * We don't broadcast to the process group (kill(0, …)) because
       * that would also signal whoever launched us. pacwich subprocesses
       * clean themselves up.
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
