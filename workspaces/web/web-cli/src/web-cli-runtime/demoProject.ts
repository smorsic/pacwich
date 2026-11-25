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
 * Pacwich configs are hand-authored in `demo-project/pacwichConfigs.ts`: the
 * project config carries the defaults and tag-based workspace dependency
 * rules, and each workspace's own config carries just its alias and tags.
 * The browser CLI never evaluates `.ts` configs
 * (`--disable-executable-configs`), so each config is seeded twice: a
 * `.jsonc` file pacwich actually parses, and a `.ts` display twin derived
 * from that same jsonc so the file tree shows idiomatic TS config files.
 */
import { vol } from "memfs";
import {
  PACWICH_PROJECT_JSONC_SOURCE,
  WORKSPACE_CONFIGS,
} from "./demo-project/pacwichConfigs";
import { SCRIPT_MOCKS } from "./demo-project/scriptMocks";
import {
  buildBaseFileMap,
  json,
  PROJECT_ROOT,
  WORKSPACE_DIRS,
} from "./demoProjectBase";

export { PROJECT_ROOT, WORKSPACE_DIRS } from "./demoProjectBase";

/**
 * Keys that are valid JS identifiers are unquoted so a derived config `.ts`
 * twin reads like idiomatic `defineProjectConfig`/`defineWorkspaceConfig`
 * usage instead of raw JSON. It's display only: the real config pacwich
 * parses is the sibling `.jsonc` file, since `--disable-executable-configs`
 * means `.ts` config files are never evaluated here. The tree view hides
 * the `.jsonc` files (see `CONFIG_JSONC_PATTERN` below) so each pair reads
 * as one file, not two.
 */
const IDENTIFIER_KEY_PATTERN = /"([A-Za-z_$][A-Za-z0-9_$]*)":/g;

/** Config files that exist only to be parsed, each with a `.ts` display twin. */
const CONFIG_JSONC_PATTERN = /\/pacwich\.(project|workspace)\.jsonc$/;

const toConfigDisplayTs = (defineFunctionName: string, jsonc: string): string =>
  `import { ${defineFunctionName} } from "pacwich/config";\n\nexport default ${defineFunctionName}(${jsonc.replace(
    IDENTIFIER_KEY_PATTERN,
    "$1:",
  )});\n`;

/** Build the flat file map seeded into memfs. */
const buildFileMap = (): Record<string, string> => {
  const files: Record<string, string> = {
    ...buildBaseFileMap(),
    [`${PROJECT_ROOT}/pacwich.project.jsonc`]: PACWICH_PROJECT_JSONC_SOURCE,
    [`${PROJECT_ROOT}/pacwich.project.ts`]: toConfigDisplayTs(
      "defineProjectConfig",
      PACWICH_PROJECT_JSONC_SOURCE,
    ),
  };
  for (const { dir } of WORKSPACE_DIRS) {
    const workspaceConfigJsonc = json(WORKSPACE_CONFIGS[dir]);
    files[`${PROJECT_ROOT}/${dir}/pacwich.workspace.jsonc`] =
      workspaceConfigJsonc;
    files[`${PROJECT_ROOT}/${dir}/pacwich.workspace.ts`] = toConfigDisplayTs(
      "defineWorkspaceConfig",
      workspaceConfigJsonc,
    );
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
    .filter(([path]) => !CONFIG_JSONC_PATTERN.test(path))
    .map(([path, content]) => ({
      relativePath: path.slice(`${PROJECT_ROOT}/`.length),
      content,
    }));
