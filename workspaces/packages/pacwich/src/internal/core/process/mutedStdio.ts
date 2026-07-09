const NOOP_CONSOLE = new Proxy({} as Console, { get: () => () => undefined });

/**
 * Run `fn` with stdout/stderr output swallowed, so incidental output (a
 * config file's `console.log`, a logger line) can't corrupt a stream that
 * must stay clean, like completion candidates or the MCP stdio protocol.
 * Both `process.std*.write` (the logger's path) and the whole `console`
 * (Bun writes it straight to the fd, bypassing `process.stdout.write`) are
 * muted, then restored even if `fn` throws. Synchronous only: output emitted
 * after `fn` returns (async side effects) is not muted.
 */
export const withMutedStdio = <T>(fn: () => T): T => {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalConsole = globalThis.console;
  const swallow = (() => true) as typeof process.stdout.write;
  process.stdout.write = swallow;
  process.stderr.write = swallow;
  globalThis.console = NOOP_CONSOLE;
  try {
    return fn();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    globalThis.console = originalConsole;
  }
};
