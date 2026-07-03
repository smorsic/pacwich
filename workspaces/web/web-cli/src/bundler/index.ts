/**
 * Build wiring shared by every consumer that bundles the browser CLI (the
 * local preview app here, and the documentation website).
 *
 * Running the real pacwich CLI in a browser bundle needs three things applied
 * to the host's rspack/rsbuild build:
 *
 *  1. `nodePolyfillOptions` — polyfill Node built-ins (path/buffer/url/…) and,
 *     crucially, turn the `process` *global* OFF so bare `process` resolves to
 *     the runtime shim (`engine/processShim`, installed before the CLI runs)
 *     rather than a generic polyfill.
 *  2. `webCliAliases` — redirect `fs`/`os` to memfs-backed shims and stub the
 *     Node built-ins the CLI imports but never runs on the browser path.
 *  3. `createMockSubprocessPlugin` — replace pacwich's single spawn chokepoint
 *     (`runScript/subprocesses.ts`) with the browser mock, so the *real*
 *     scheduler still runs above it (`--dep-order`, parallelism) but no process
 *     is ever launched.
 *
 * These are exposed as plain values/factories so each host can splice them into
 * its own config shape (a standalone `rsbuild.config.ts`, or rspress's
 * `builderConfig`). Consumers must also pass `globals.Buffer: true` — see
 * `nodePolyfillOptions`.
 */

import { fileURLToPath } from "node:url";

/**
 * Absolute path to `src/engine/<name>.ts`, resolved from this module's own
 * location. Aliases/replacements must be absolute paths, not package
 * specifiers: bundlers resolve a replaced request relative to the *importer*
 * (pacwich, deep in its own isolated `node_modules`), from where
 * `@pacwich/web-cli/...` isn't reachable. An absolute path resolves anywhere.
 */
const enginePath = (name: string): string =>
  fileURLToPath(new URL(`../engine/${name}.ts`, import.meta.url));

/**
 * Options for `@rsbuild/plugin-node-polyfill`'s `pluginNodePolyfill(...)`.
 *
 * `process: false` is the important bit: it prevents the plugin from injecting
 * a `process` global, leaving bare `process` to resolve to the shim that
 * `runPacwichCli` installs on `globalThis` before importing pacwich.
 */
export const nodePolyfillOptions = {
  globals: { process: false, Buffer: true },
  protocolImports: true,
} as const;

/**
 * `resolve.alias` entries. Values are package subpath specifiers (resolved via
 * this package's `exports` map) so consumers don't depend on absolute paths.
 *
 *  - `fs`/`os` → memfs-backed shims (the CLI's filesystem is the seeded volume;
 *    the stock `os` polyfill omits `constants.signals`, read at CLI load).
 *  - `child_process`/`readline`/`module`/`stream/consumers`/`jiti` → stubs that
 *    throw if called. They're imported by the CLI but never executed on the
 *    browser path (no script spawning, no executable configs).
 */
export const webCliAliases: Record<string, string> = {
  fs: enginePath("fsShim"),
  "node:fs": enginePath("fsShim"),
  os: enginePath("osShim"),
  "node:os": enginePath("osShim"),
  child_process: enginePath("stubs"),
  "node:child_process": enginePath("stubs"),
  readline: enginePath("stubs"),
  "node:readline": enginePath("stubs"),
  module: enginePath("stubs"),
  "node:module": enginePath("stubs"),
  "stream/consumers": enginePath("stubs"),
  "node:stream/consumers": enginePath("stubs"),
  jiti: enginePath("stubs"),
};

/** Module the mock replaces pacwich's real leaf spawn with. */
const MOCK_SUBPROCESS_REQUEST = enginePath("mockSubprocess");

/**
 * pacwich funnels every spawn (scripts + git) through the single
 * `createSubprocess()` in `runScript/subprocesses.ts`. This swaps that one
 * module for the browser mock. It's imported from a few dirs (`./subprocesses`
 * from runScript/, `../runScript/subprocesses` from affected/, inputs/), so we
 * resolve the request against its importer and match the absolute target,
 * catching every importer without rewriting any unrelated `subprocesses` file.
 *
 * `rspack` is passed in (rather than imported) so this module carries no build
 * dependency; the caller supplies `rspack` from `@rsbuild/core`.
 */
export const createMockSubprocessPlugin = <Plugin>(rspack: {
  NormalModuleReplacementPlugin: new (
    resourceRegExp: RegExp,
    newResource: (resource: { request: string; context?: string }) => void,
  ) => Plugin;
}): Plugin => {
  const resolveAbsolute = (context: string, request: string): string => {
    // Minimal POSIX-ish resolve: enough to normalize `<context>/<request>`.
    const parts = `${context}/${request}`.split("/");
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "" || part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }
    return `/${stack.join("/")}`;
  };

  return new rspack.NormalModuleReplacementPlugin(
    /(^|[\\/])subprocesses(\.[jt]s)?$/,
    (resource) => {
      const resolved = resolveAbsolute(
        resource.context ?? "",
        resource.request,
      );
      if (/[\\/]runScript[\\/]subprocesses(\.[jt]s)?$/.test(resolved)) {
        resource.request = MOCK_SUBPROCESS_REQUEST;
      }
    },
  );
};
