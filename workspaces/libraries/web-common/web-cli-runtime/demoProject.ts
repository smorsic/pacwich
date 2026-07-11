/**
 * Loads the static demo monorepo (in `src/demo-project/`) into the shared
 * memfs volume so the pacwich CLI can read it like a real project on disk, and
 * resolves how each script run is mocked (from `demo-project/scriptMocks.ts`).
 *
 * The demo project is a genuine set of static files — edit the `package.json`s
 * / lockfile there to change what the CLI sees. We import them directly (JSON
 * imports work under both rspress and bun, and aren't affected by the tests'
 * `fs` mock, since `import` uses the native loader rather than the `fs` module).
 *
 * pacwich's npm adapter discovers workspaces from `package-lock.json`'s
 * `packages` map, so the lockfile is the source of truth for which directories
 * are workspaces; each workspace still needs its own `package.json`.
 */
import { vol } from "memfs";
import webPkg from "./demo-project/apps/web/package.json";
import packageLock from "./demo-project/package-lock.json";
import rootPackageJson from "./demo-project/package.json";
import corePkg from "./demo-project/packages/core/package.json";
import utilsPkg from "./demo-project/packages/utils/package.json";
import { SCRIPT_MOCKS } from "./demo-project/scriptMocks";

export const PROJECT_ROOT = "/project";

/** Each workspace directory paired with its (statically imported) package.json. */
const WORKSPACE_DIRS = [
  { dir: "packages/utils", pkg: utilsPkg },
  { dir: "packages/core", pkg: corePkg },
  { dir: "apps/web", pkg: webPkg },
] as const;

/**
 * Source files seeded per workspace so `--files` globs have real files to
 * match, and so the file tree view has something to show. Their content is
 * placeholder flavor — only their existence matters.
 */
const WORKSPACE_SOURCE_FILES = ["src/index.ts", "src/lib.ts"];

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Build the flat file map seeded into memfs. */
const buildFileMap = (): Record<string, string> => {
  const files: Record<string, string> = {
    [`${PROJECT_ROOT}/package.json`]: json(rootPackageJson),
    [`${PROJECT_ROOT}/package-lock.json`]: json(packageLock),
  };
  for (const { dir, pkg } of WORKSPACE_DIRS) {
    files[`${PROJECT_ROOT}/${dir}/package.json`] = json(pkg);
    for (const sourceFile of WORKSPACE_SOURCE_FILES) {
      files[`${PROJECT_ROOT}/${dir}/${sourceFile}`] =
        `// ${pkg.name} — ${sourceFile}\n`;
    }
  }
  return files;
};

let seeded = false;

/** Write the demo project into the memfs volume (idempotent). */
export const seedDemoProject = () => {
  if (seeded) return;
  vol.fromJSON(buildFileMap());
  seeded = true;
};

/* -------------------------- script-run mocking --------------------------- */

/** Absolute workspace directory (memfs) → workspace name, for the mock's cwd lookup. */
const workspaceNameByDir: Record<string, string> = Object.fromEntries(
  WORKSPACE_DIRS.map(({ dir, pkg }) => [`${PROJECT_ROOT}/${dir}`, pkg.name]),
);

/** Resolve which workspace a subprocess cwd belongs to (null if none). */
export const workspaceNameForCwd = (cwd: string | undefined): string | null => {
  if (!cwd) return null;
  return workspaceNameByDir[cwd.replace(/\/+$/, "")] ?? null;
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

/* ---------------------------- file tree fixture --------------------------- */

export type DemoProjectFile = {
  relativePath: string;
  content: string;
};

/**
 * The demo project's files as `{relativePath, content}` pairs, relative to
 * `PROJECT_ROOT` — the shape the file tree view renders. Derived from the
 * same seed data as `seedDemoProject()` so the tree can never drift from
 * what's actually loaded into memfs.
 */
export const getDemoProjectFiles = (): DemoProjectFile[] =>
  Object.entries(buildFileMap()).map(([path, content]) => ({
    relativePath: path.slice(`${PROJECT_ROOT}/`.length),
    content,
  }));
