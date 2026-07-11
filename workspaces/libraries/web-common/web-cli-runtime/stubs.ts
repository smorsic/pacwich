/**
 * Stub modules aliased in for Node built-ins / packages that the bundled CLI
 * imports but never executes on the `list-workspaces` (read-only) path:
 *
 *  - `child_process` — only reached when running scripts or detecting pnpm/pm
 *    versions (the bun/npm version check returns early without spawning).
 *  - `readline` — pulled in transitively by the MCP command module.
 *  - `module` (`createRequire`) — evaluated at the top of the config loader;
 *    only invoked when loading executable `.ts`/`.js` configs, which we
 *    disable (`disableExecutableConfigs: true`).
 *  - `jiti` — the TS config loader; same story, never invoked here.
 *
 * Each throws if actually called, so if the demo grows to exercise these
 * paths, the failure is loud and obvious rather than silently wrong.
 */

const unavailable = (what: string) => () => {
  throw new Error(
    `${what} is not available in the browser web-cli (script execution is not wired up yet).`,
  );
};

/* ----------------------------- child_process ----------------------------- */

export const execFileSync = unavailable("child_process.execFileSync");
export const execFile = unavailable("child_process.execFile");
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

export const text = unavailable("stream/consumers.text");
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
