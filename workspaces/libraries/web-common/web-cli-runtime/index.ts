/**
 * The public surface of the in-browser pacwich CLI runtime, shared between
 * workspaces/web/web-cli and documentation-website's /web-cli page.
 *
 * The shims (bufferShim, fsShim, osShim, pathShim, processShim, stubs),
 * mockSubprocess.ts, and mockSubprocessRspackPlugin.ts are deliberately NOT
 * re-exported here — they're consumed either as import-for-side-effect
 * dependencies of runPacwichCli.ts itself, as raw filesystem paths for a
 * bundler's resolve.alias / NormalModuleReplacementPlugin, or via a direct
 * subpath import in tests (e.g. `@pacwich/web-common/web-cli-runtime/mockSubprocess`
 * for its exported `runLog`).
 */
export {
  PROJECT_ROOT,
  seedDemoProject,
  getDemoProjectFiles,
  workspaceNameForCwd,
  resolveScriptMock,
} from "./demoProject";
export type { DemoProjectFile, ResolvedScriptMock } from "./demoProject";

export { runPacwichCli, runPacwichCliArgv, tokenize } from "./runPacwichCli";
export type { OutputStream, RunOptions, RunResult } from "./runPacwichCli";

export { checkCommandLine } from "./webCliGuards";
export type { GuardResult } from "./webCliGuards";

export { localWebCliClient } from "./localWebCliClient";
export type {
  HealthResponse,
  ReadyResponse,
  InvokeCliRequestBody,
  InvokeCliError,
  InvokeCliResponseChunk,
  HttpClient,
} from "./webCliClientTypes";
