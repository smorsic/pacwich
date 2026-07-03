/**
 * Loads the demo monorepo into the shared memfs volume so the pacwich CLI can
 * read it like a real project on disk, and resolves how each script run is
 * mocked (from `scriptMocks.ts`).
 *
 * The file set lives in `files.ts` as inlined strings — see that module for
 * why. Here we write them into memfs (via the shared `vol`, which the `fs`
 * shim reads back) and expose the lookups the subprocess mock needs.
 */
import { vol } from "memfs";
import { demoProjectFiles } from "./files";
import { SCRIPT_MOCKS } from "./scriptMocks";

export { demoProjectFiles, type DemoProjectFile } from "./files";

export const PROJECT_ROOT = "/project";

/** Absolute workspace directory (memfs) → workspace name, for cwd lookups. */
const WORKSPACE_NAME_BY_DIR: Record<string, string> = {
  [PROJECT_ROOT]: "demo-monorepo",
  [`${PROJECT_ROOT}/packages/shared`]: "shared",
  [`${PROJECT_ROOT}/packages/backend`]: "backend",
  [`${PROJECT_ROOT}/packages/frontend`]: "frontend",
};

let seeded = false;

/** Write the demo project into the memfs volume (idempotent). */
export const seedDemoProject = () => {
  if (seeded) return;
  vol.fromJSON(
    Object.fromEntries(
      demoProjectFiles.map((file) => [
        `${PROJECT_ROOT}/${file.relativePath}`,
        file.content,
      ]),
    ),
  );
  seeded = true;
};

/* -------------------------- script-run mocking --------------------------- */

/** Resolve which workspace a subprocess cwd belongs to (null if none). */
export const workspaceNameForCwd = (cwd: string | undefined): string | null => {
  if (!cwd) return null;
  return WORKSPACE_NAME_BY_DIR[cwd.replace(/\/+$/, "")] ?? null;
};

export type ResolvedScriptMock = {
  output: string[];
  delayMsPerLine: number;
  exitCode: number;
};

/**
 * Look up the mock for a `workspace:script`, falling back most-specific-first
 * (`ws:script` → `*:script` → `ws:*` → `*:*`), and substitute `{workspace}` /
 * `{script}` in the output lines.
 */
export const resolveScriptMock = (
  workspaceName: string,
  scriptName: string,
): ResolvedScriptMock => {
  const mock =
    SCRIPT_MOCKS[`${workspaceName}:${scriptName}`] ??
    SCRIPT_MOCKS[`*:${scriptName}`] ??
    SCRIPT_MOCKS[`${workspaceName}:*`] ??
    SCRIPT_MOCKS["*:*"];

  const substitute = (line: string) =>
    line
      .replaceAll("{workspace}", workspaceName)
      .replaceAll("{script}", scriptName);

  return {
    output: (mock?.output ?? [`$ ${scriptName} (${workspaceName})`]).map(
      substitute,
    ),
    delayMsPerLine: mock?.delayMsPerLine ?? 0,
    exitCode: mock?.exitCode ?? 0,
  };
};
