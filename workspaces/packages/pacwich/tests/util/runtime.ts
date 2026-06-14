import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isDeepStrictEqual } from "util";

export { stripANSI } from "../../src/internal/core/language/string/stripANSI";

export const IS_BUN = typeof Bun !== "undefined";

/**
 * Whether the test harness can spawn the CLI with a PTY (so terminal
 * frame snapshots reflect the real TTY rendering path). Bun's
 * `Bun.spawn` supports it natively; the Node port routes through
 * `child_process.spawn`, which doesn't. `createCliSubprocess` uses
 * `Bun.spawn` when this is true and a `terminal` option is provided.
 */
export const IS_PTY_SUPPORTED = IS_BUN;

/** Replacement for `Bun.sleep(ms)`. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Replacement for `Bun.deepEquals(a, b)`. */
export const deepEquals = (a: unknown, b: unknown): boolean =>
  isDeepStrictEqual(a, b);

/** Replacement for Bun's `import.meta.main` boolean. */
export const isMainModule = (importMetaUrl: string): boolean =>
  process.argv[1] === fileURLToPath(importMetaUrl);

/** Replacement for Bun's `import.meta.dir`. */
export const getModuleDir = (importMetaUrl: string): string =>
  path.dirname(fileURLToPath(importMetaUrl));

/** Replacement for `await Bun.file(path).text()`. */
export const readFileText = (filePath: string): Promise<string> =>
  fs.promises.readFile(filePath, "utf8");

/**
 * `Bun.semver.satisfies(Bun.version, range)` — checks whether the current
 * Bun runtime version satisfies the given range. Always returns false on
 * Node since the question is meaningless off-Bun.
 */
export const bunVersionSatisfies = (range: string): boolean =>
  IS_BUN ? Bun.semver.satisfies(Bun.version, range) : false;

export type DetachedSubprocess = {
  stdout: AsyncIterable<Uint8Array> | null;
  kill: (signal: NodeJS.Signals) => void;
  exited: Promise<number>;
};

export type SpawnDetachedOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: "pipe" | "ignore";
  stderr?: "pipe" | "ignore";
};

/**
 * Spawn a detached subprocess for tests that need the child to be its
 * own process-group leader (so signals sent inside the child don't
 * reach the test runner). Mirrors the subset of `Bun.spawn` used in
 * tests; runs the same way under both Bun and Node.
 */
export const spawnDetached = (
  argv: string[],
  options: SpawnDetachedOptions = {},
): DetachedSubprocess => {
  const [command, ...args] = argv;
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ["ignore", options.stdout ?? "pipe", options.stderr ?? "ignore"],
  });

  const exited = new Promise<number>((resolve) => {
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 128 : 1)));
    child.once("error", () => resolve(1));
  });

  return {
    stdout: child.stdout as AsyncIterable<Uint8Array> | null,
    kill: (signal) => {
      child.kill(signal);
    },
    exited,
  };
};
