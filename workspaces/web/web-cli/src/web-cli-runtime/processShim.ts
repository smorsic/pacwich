/**
 * A browser `process` shim tailored to what the pacwich CLI touches.
 *
 * `@rsbuild/plugin-node-polyfill` is configured with `globals.process: false`
 * so that bare `process` references in the bundled CLI resolve to this global
 * object instead of a generic polyfill. That lets us provide the bits the CLI
 * actually uses — `stdout`/`stderr` writers, a non-fatal `exit`, `cwd`, `env`,
 * and noop signal handlers — none of which the stock browser polyfill covers.
 */

/** Thrown by `process.exit()` so callers can surface the code instead of killing the page. */
export class ProcessExit extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
    this.name = "ProcessExit";
  }
}

export type StreamWriter = (chunk: string) => void;

type Std = {
  columns: number;
  rows: number;
  isTTY: boolean;
  write: (chunk: unknown) => boolean;
};

const makeStd = (columns: number, rows: number): Std => ({
  columns,
  rows,
  // Reporting a real TTY here is what makes pacwich's `getDefaultOutputStyle()`
  // pick "grouped" (its live-updating, cursor-redrawing renderer) instead of
  // falling back to plain `[workspace] text` lines. Its raw ANSI cursor-movement
  // escapes flow through `write` unmodified and xterm.js renders them exactly
  // like a real terminal would, so no actual PTY is needed to get that output.
  isTTY: true,
  write: () => true,
});

// Grouped mode reads `process.stdin.on("data", ...)` unconditionally (it's
// how it catches raw Ctrl+C/Ctrl+\ while it owns the tty) even though the web
// CLI never forwards live keystrokes into a running command — the listener
// just never fires. `pause`/`setRawMode`/`unref` are the shutdown path
// (`tuiTerminal.ts`'s `resetTuiTerminalState`) and only need to not throw.
const makeStdin = () => {
  const stdin = {
    isTTY: true,
    on: () => stdin,
    once: () => stdin,
    removeListener: () => stdin,
    pause: () => stdin,
    resume: () => stdin,
    setRawMode: () => stdin,
    unref: () => stdin,
  };
  return stdin;
};

const noop = () => globalThis.process;

/**
 * Install (once) a `process` global suitable for running the CLI. Returns the
 * same object on repeat calls, updating stdout/stderr dimensions in place
 * each time so a live terminal resize is reflected on the next run.
 */
export const installProcessShim = (dimensions?: {
  columns: number;
  rows: number;
}): NodeJS.Process => {
  const existing = (globalThis as { process?: NodeJS.Process }).process;
  if (existing && (existing as { __pacwichShim?: boolean }).__pacwichShim) {
    if (dimensions) {
      const { stdout, stderr } = existing as unknown as {
        stdout: Std;
        stderr: Std;
      };
      stdout.columns = stderr.columns = dimensions.columns;
      stdout.rows = stderr.rows = dimensions.rows;
    }
    return existing;
  }

  const { columns = 80, rows = 30 } = dimensions ?? {};

  const proc = {
    __pacwichShim: true,
    platform: "linux",
    arch: "x64",
    argv: ["node", "pacwich"],
    // SHELL/TERM exist only so `doctor` has something to report — nothing
    // else in the CLI reads them.
    env: {
      NODE_ENV: "production",
      SHELL: "/bin/bash",
      TERM: "xterm-256color",
    } as Record<string, string>,
    execPath: "/usr/bin/node",
    version: "v24.15.0",
    versions: { node: "24.15.0" } as Record<string, string>,
    stdout: makeStd(columns, rows),
    stderr: makeStd(columns, rows),
    stdin: makeStdin(),
    cwd: () => "/project",
    chdir: () => undefined,
    exit: (code = 0) => {
      throw new ProcessExit(code);
    },
    kill: () => true,
    nextTick: (fn: (...a: unknown[]) => void, ...args: unknown[]) =>
      queueMicrotask(() => fn(...args)),
    on: noop,
    once: noop,
    off: noop,
    addListener: noop,
    removeListener: noop,
    emit: () => false,
    emitWarning: () => undefined,
    hrtime: Object.assign(() => [0, 0] as [number, number], {
      bigint: () => BigInt(0),
    }),
  };

  (globalThis as unknown as { process: typeof proc }).process = proc;
  return proc as unknown as NodeJS.Process;
};

// Install on import. Importing this module (before any CLI module) is what
// guarantees `process` exists by the time pacwich's modules evaluate
// top-level `process.platform` / `process.versions` reads.
installProcessShim();
