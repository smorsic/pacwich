/**
 * Public entry for the demo monorepo the web CLI operates on.
 *
 * Consumers (e.g. the docs site's file tree) import `demoProjectFiles` and
 * `PROJECT_ROOT` from here; the engine imports the seeding + mock-resolution
 * helpers from `./demoProject`.
 */
export {
  PROJECT_ROOT,
  seedDemoProject,
  workspaceNameForCwd,
  resolveScriptMock,
  demoProjectFiles,
  type DemoProjectFile,
  type ResolvedScriptMock,
} from "./demoProject";
