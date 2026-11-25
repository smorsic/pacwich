/**
 * Stub modules aliased in for Node built-ins / packages that the bundled CLI
 * imports but never executes on the `list-workspaces` (read-only) path:
 *
 *  - `child_process` — reached when running scripts (mocked separately, see
 *    `mockSubprocess.ts`) and when `doctor` probes package manager versions
 *    via `<binary> --version` (bun's own check returns early without
 *    spawning when running under Bun, which the browser never is). The
 *    latter is special-cased below with a fake version instead of throwing,
 *    so `doctor` has something plausible to report.
 *  - `readline` — pulled in transitively by the MCP command module.
 *  - `module` (`createRequire`) — evaluated at the top of the config loader;
 *    only invoked when loading executable `.ts`/`.js` configs, which we
 *    disable (`disableExecutableConfigs: true`).
 *  - `jiti` — the TS config loader; same story, never invoked here.
 *  - `stream/consumers` — `text()` reads the (mocked) `git` subprocess's
 *    stdout/stderr for `verify` and `affected`'s git-diff resolution. Both
 *    features check the process's exit code to detect "no git here"
 *    gracefully, so `text()` needs a real implementation rather than a
 *    throw — otherwise reading the mocked process's output blows up before
 *    that exit-code check ever runs.
 *
 * Everything else throws if actually called, so if the demo grows to
 * exercise these paths, the failure is loud and obvious rather than
 * silently wrong.
 */

import { promisify } from "util";

const unavailable = (what: string) => () => {
  throw new Error(
    `${what} is not available in the browser web-cli (script execution is not wired up yet).`,
  );
};

/* ----------------------------- child_process ----------------------------- */

/** `doctor`'s package manager probe: `execFile(binary, ["--version"], opts, cb)`. */
const FAKE_PACKAGE_MANAGER_VERSIONS: Record<string, string> = {
  bun: "1.2.19",
  npm: "10.9.2",
  pnpm: "10.12.1",
};

export const execFileSync = unavailable("child_process.execFileSync");
export const execFile = (
  binary: string,
  args?: unknown,
  optionsOrCallback?: unknown,
  maybeCallback?: unknown,
) => {
  const callback = (
    typeof maybeCallback === "function" ? maybeCallback : optionsOrCallback
  ) as
    ((error: Error | null, stdout: string, stderr: string) => void) | undefined;
  const fakeVersion = FAKE_PACKAGE_MANAGER_VERSIONS[binary];

  if (
    fakeVersion &&
    Array.isArray(args) &&
    args[0] === "--version" &&
    callback
  ) {
    queueMicrotask(() => callback(null, `${fakeVersion}\n`, ""));
    return undefined;
  }

  return unavailable("child_process.execFile")();
};
// Node's real `execFile` resolves `{ stdout, stderr }` (not just the first
// callback arg) when promisified — matched here so
// `detectPackageManagerVersion.ts`'s `const { stdout } = await
// execFileAsync(...)` destructure works against our fake success path too.
(execFile as unknown as { [promisify.custom]?: unknown })[promisify.custom] = (
  binary: string,
  args?: unknown,
  options?: unknown,
) =>
  new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      options,
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      },
    );
  });
export const exec = unavailable("child_process.exec");
export const spawn = unavailable("child_process.spawn");
export const spawnSync = unavailable("child_process.spawnSync");
export const fork = unavailable("child_process.fork");

/* -------------------------------- readline ------------------------------- */

export const createInterface = unavailable("readline.createInterface");

/* --------------------------------- module -------------------------------- */

export const createRequire = () => {
  const require = unavailable("require()") as unknown as ((
    id: string,
  ) => unknown) & {
    resolve: (id: string) => string;
  };
  require.resolve = unavailable("require.resolve") as unknown as (
    id: string,
  ) => string;
  return require;
};

/* ---------------------------------- jiti --------------------------------- */

export const createJiti = unavailable("jiti.createJiti");

/* ----------------------------- stream/consumers -------------------------- */

/** Real implementation: consumes the mocked subprocess's byte-chunk stream. */
export const text = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<string> => {
  const decoder = new TextDecoder();
  let result = "";
  for await (const chunk of stream) {
    result += decoder.decode(chunk, { stream: true });
  }
  return result + decoder.decode();
};
export const json = unavailable("stream/consumers.json");
export const buffer = unavailable("stream/consumers.buffer");
export const arrayBuffer = unavailable("stream/consumers.arrayBuffer");
export const blob = unavailable("stream/consumers.blob");

export default {
  execFileSync,
  execFile,
  exec,
  spawn,
  spawnSync,
  fork,
  createInterface,
  createRequire,
  createJiti,
};
