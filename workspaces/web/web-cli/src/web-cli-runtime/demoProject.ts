/**
 * Loads the static demo monorepo (in `src/demo-project/`) into the shared
 * memfs volume so the pacwich CLI can read it like a real project on disk, and
 * resolves how each script run is mocked (from `demo-project/scriptMocks.ts`).
 *
 * The demo project is a genuine set of static files for `package.json`s and
 * `tsconfig.json`s, imported directly (JSON imports work under both rspress
 * and bun, and aren't affected by the tests' `fs` mock, since `import` uses
 * the native loader rather than the `fs` module). Everything else (source
 * files, `pnpm-lock.yaml`) is generated from plain data in
 * `sourceFiles.ts`/`pnpmFiles.ts`, since there's no bundler-neutral way to
 * import arbitrary text files as strings.
 *
 * pacwich's pnpm adapter discovers workspaces from `pnpm-lock.yaml`'s
 * `importers` map, so the lockfile is the source of truth for which
 * directories are workspaces; each workspace still needs its own
 * `package.json`.
 *
 * `demo-project/pacwich.project.ts` is real, hand-authored config, actually
 * evaluated (see `scripts/generateDemoConfig.ts`, run automatically on
 * `bun install` via this workspace's `prepare` script) against the rest of
 * this demo project to resolve each workspace's tags/rules for real, since
 * the browser CLI never evaluates `.ts` configs itself
 * (`--disable-executable-configs`). The resolved output lands in
 * `demo-project/generated/` (gitignored) and gets flattened into each
 * workspace's own `pacwich.workspace.jsonc` below.
 */
import { vol } from "memfs";
import {
  PACWICH_PROJECT_TS_SOURCE,
  WORKSPACE_TAGS_AND_RULES,
} from "./demo-project/generated/workspaceConfig";
import { WORKSPACE_ALIASES } from "./demo-project/pacwichConfigs";
import { SCRIPT_MOCKS } from "./demo-project/scriptMocks";
import {
  buildBaseFileMap,
  json,
  PROJECT_ROOT,
  WORKSPACE_DIRS,
} from "./demoProjectBase";

export { PROJECT_ROOT, WORKSPACE_DIRS } from "./demoProjectBase";

/**
 * Keys that are valid JS identifiers are unquoted so the generated
 * `pacwich.workspace.ts` reads like idiomatic `defineWorkspaceConfig` usage
 * instead of raw JSON. It's display only: the real config pacwich parses is
 * the sibling `.jsonc` file, since `--disable-executable-configs` means
 * `.ts` config files are never evaluated here. The tree view hides the
 * `.jsonc` file (see `CONFIG_JSONC_FILENAME` below) so the pair reads as
 * one file, not two.
 */
const IDENTIFIER_KEY_PATTERN = /"([A-Za-z_$][A-Za-z0-9_$]*)":/g;

/** The one config filename that only exists to be parsed, with a `.ts` display twin. */
const CONFIG_JSONC_FILENAME = "pacwich.workspace.jsonc";

const toDefineWorkspaceConfigTs = (jsonc: string): string =>
  `import { defineWorkspaceConfig } from "pacwich/config";\n\nexport default defineWorkspaceConfig(${jsonc.replace(
    IDENTIFIER_KEY_PATTERN,
    "$1:",
  )});\n`;

/** Build the flat file map seeded into memfs. */
const buildFileMap = (): Record<string, string> => {
  const files: Record<string, string> = {
    ...buildBaseFileMap(),
    [`${PROJECT_ROOT}/pacwich.project.ts`]: PACWICH_PROJECT_TS_SOURCE,
  };
  for (const { dir } of WORKSPACE_DIRS) {
    const workspaceConfig = {
      alias: WORKSPACE_ALIASES[dir],
      ...WORKSPACE_TAGS_AND_RULES[dir],
    };
    const workspaceConfigJsonc = json(workspaceConfig);
    files[`${PROJECT_ROOT}/${dir}/pacwich.workspace.jsonc`] =
      workspaceConfigJsonc;
    files[`${PROJECT_ROOT}/${dir}/pacwich.workspace.ts`] =
      toDefineWorkspaceConfigTs(workspaceConfigJsonc);
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
 * `PROJECT_ROOT`, the shape the file tree view renders. Derived from the
 * same seed data as `seedDemoProject()` so the tree can never drift from
 * what's actually loaded into memfs, minus the `.jsonc` config files, which
 * are seeded (pacwich genuinely parses them) but not shown, since their
 * `.ts` twin already represents the same config in the tree.
 */
export const getDemoProjectFiles = (): DemoProjectFile[] =>
  Object.entries(buildFileMap())
    .filter(([path]) => !path.endsWith(`/${CONFIG_JSONC_FILENAME}`))
    .map(([path, content]) => ({
      relativePath: path.slice(`${PROJECT_ROOT}/`.length),
      content,
    }));
