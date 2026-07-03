/**
 * Public engine API: run the real pacwich CLI in the browser over an in-memory
 * filesystem, streaming its output back to a terminal UI.
 *
 * This is the surface consumers (the docs site, the local preview app) use.
 * The build wiring that makes it work in a bundle — the `fs`/`os` aliases, the
 * `process` shim, and the subprocess replacement — lives in `../bundler`.
 */
export {
  runPacwichCli,
  tokenize,
  type OutputStream,
  type RunOptions,
  type RunResult,
} from "./runPacwichCli";

export { checkCommandLine, type GuardResult } from "./webCliGuards";

/**
 * A single chunk of terminal output. This replaces the old backend's
 * `InvokeCliResponseChunk`: the browser engine produces `terminalOutput`
 * directly (stderr pre-styled), so `warnings`/`errors` stay empty but are kept
 * so the existing terminal renderer needs no changes.
 */
export type WebCliOutputChunk = {
  terminalOutput: string;
  warnings: { message: string }[];
  errors: { message: string }[];
};
