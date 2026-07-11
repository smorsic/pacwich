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
  isTTY: false,
  write: () => true,
});

const noop = () => globalThis.process;

/**
 * Install (once) a `process` global suitable for running the CLI. Returns the
 * same object on repeat calls so dimensions can be tweaked between runs.
 */
export const installProcessShim = (): NodeJS.Process => {
  const existing = (globalThis as { process?: NodeJS.Process }).process;
  if (existing && (existing as { __pacwichShim?: boolean }).__pacwichShim) {
    return existing;
  }

  const proc = {
    __pacwichShim: true,
    platform: "linux",
    arch: "x64",
    argv: ["node", "pacwich"],
    env: { NODE_ENV: "production" } as Record<string, string>,
    version: "v24.15.0",
    versions: { node: "24.15.0" } as Record<string, string>,
    stdout: makeStd(80, 30),
    stderr: makeStd(80, 30),
    cwd: () => "/project",
    chdir: () => undefined,
    exit: (code = 0) => {
      throw new ProcessExit(code);
    },
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
