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
    process.exit(code);
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
      // Re-raise the signal on ourselves so we exit with the conventional
      // 128 + signum code via the signal's default action. Descendant
      // cleanup is handled per-child by the subprocess registry (see
      // src/runScript/subprocesses.ts), which kills each tracked child's
      // process group individually. Broadcasting here via `kill(0, signal)`
      // would also signal anyone sharing our pgid (e.g. a vitest worker
      // that imported this code), which can deadlock the host runner.
      process.kill(process.pid, signal);
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
