## pacwich npm package: Configuration files

`pacwich` is a package that is zero-config by default but accepts optional configuration files for project-level and workspace-level settings.

### Project config

Optional project config can be placed in `pacwich.project.ts`/`pacwich.project.js`/`pacwich.project.jsonc`/`pacwich.project.json` in the root directory, or in the `"pacwich-project"` key of the root `package.json`.

Config defaults here take precedence over environment variables. Explicit CLI arguments or API options take precedence over all other settings.

```jsonc
{
  // Pin the package manager backend explicitly. When omitted, pacwich
  // auto-detects from the lockfiles in the project root. The CLI `--pm`
  // flag (and the API `packageManager` option) take precedence over this
  // field, which in turn takes precedence over the `PACWICH_PACKAGE_MANAGER`
  // env var. Not nested under "defaults" because it identifies the
  // project, not a per-invocation preference.
  "packageManager": "auto", // "auto" | "bun" | "pnpm" | "npm"
  "defaults": {
    "parallelMax": 5, // same options as seen in CLI examples above
    "shell": "system", // "bun" or "system" (default "system")
    "includeRootWorkspace": true, // treat root package.json as a normal workspace
    "affectedBaseRef": "main", // default git base ref for affected resolution (env: PACWICH_AFFECTED_BASE_REF_DEFAULT)
    // Default output style for `run-script` / `run-affected` when no
    // --output-style flag is passed. CLI-only (ignored by API callers).
    // "grouped" is still downgraded to "prefixed" when stdout is not a
    // TTY. Env override: PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT.
    "cliScriptOutputStyle": "prefixed", // "grouped" | "prefixed" | "plain" | "none"
    // Suppress warnings globally by WarningId
    // See WarningId TS type or https://pacwich.dev/config/warnings/index.md for list
    "suppressWarnings": ["MultiplePackageManagerLockfiles"],
  },
  "workspacePatternConfigs": [
    // see Workspace Pattern Configs section below
  ],
  "verify": {
    "workspaceDependencies": {
      // Project-relative globs to skip during `pacwich verify` scanning.
      // Single project-level escape hatch (no per-workspace verify config).
      // Negation prefixes (`!`) are not honored here, since this is an
      // exception list rather than an inputs list.
      "ignoreInputFiles": ["scripts/codegen/**/*", "/legacy/**/*.ts"],
    },
  },
}
```

> Note: pnpm projects place their workspace globs in `pnpm-workspace.yaml`'s top-level `packages:` key (and catalogs under `catalog:` / `catalogs:`), not in `package.json.workspaces`. pacwich reads them transparently for the pnpm backend.

### mergeProjectConfig

`mergeProjectConfig` merges multiple project configs left to right. Later configs take precedence for scalar fields. `workspacePatternConfigs` entries are concatenated. Any argument may be a factory function `(prev: ProjectConfig) => ProjectConfig`.

```ts
import { mergeProjectConfig } from "pacwich/config";

export default mergeProjectConfig(
  { defaults: { parallelMax: 4 } },
  { defaults: { shell: "system" } },
  (prevConfig) => ({ defaults: { includeRootWorkspace: true } }),
);
```

## Workspace config

Optional config can be placed in `pacwich.workspace.ts`/`pacwich.workspace.js`/`pacwich.workspace.jsonc`/`pacwich.workspace.json` in a workspace directory, or in the `"pacwich"` key of the workspace's `package.json`.

Aliases must be unique to each workspace and must not clash with other workspaces' `package.json` names.

Tags are strings to group workspaces together. They do not need to be unique.

```jsonc
{
  "alias": "my-alias", // can be array
  "tags": ["my-tag"],
  // Default inputs used to determine if the workspace is affected, applied to
  // all scripts that don't configure their own inputs. See "Inputs" below.
  "defaultInputs": {
    "files": ["src/**/*.ts", "!src/**/*.test.ts"],
    "workspacePatterns": ["tag:shared-lib"],
    "externalDependencies": ["lodash", "react"],
  },
  "scripts": {
    "lint": {
      // set optional sorting order for scripts
      "order": 1,
    },
    "build": {
      // per-script inputs override defaultInputs for this script's affected resolution
      "inputs": {
        "files": ["src/**/*.ts", "/shared-types/**/*.ts"], // leading "/" = relative to the project root
      },
    },
  },
  "rules": {
    "workspaceDependencies": {
      // allowPatterns: only workspaces matching these patterns are permitted as dependencies
      "allowPatterns": ["my-allow-pattern-*"],
      // denyPatterns: workspaces matching these patterns are forbidden as dependencies.
      // When combined with allowPatterns, deny filters within the allowed subset.
      "denyPatterns": ["my-deny-pattern-*"],
    },
  },
}
```

### Inputs

The `defaultInputs` field (and the per-script `scripts[name].inputs` field) controls what counts as an input for [affected workspace](#affected-workspaces) resolution. Both have the same shape (`WorkspaceInputsConfig`):

- `files` — file paths, directories, or globs relative to the workspace's directory. Leading `/` makes a pattern relative to the project root. Prefix with `!` to exclude. Only git-trackable files are matched. Default when not provided is `["."]` (everything in the workspace dir).
- `workspacePatterns` — workspace patterns whose matched workspaces are treated as inputs (like dependencies, but without needing a real `package.json` dep edge).
- `externalDependencies` — allowlist of package names that participate in lockfile-change detection. Omitted = all external deps participate; `[]` = none participate; non-empty list = only listed names participate (intersected with the workspace's actual external deps from `package.json`).

Per-script `inputs` fully replaces `defaultInputs` for that script. The two are not merged. If a script has its own `inputs` field, `defaultInputs` is ignored for that script.

The `pacwich verify` command also reuses each workspace's `defaultInputs.files` to scope which files it scans for implicit workspace dependencies.

### Workspace Dependency Rules

Using the `rules.workspaceDependencies` field, you can define rules for which workspaces are allowed to be dependencies, using `allowPatterns`, `denyPatterns`, or both.

`allowPatterns` defines the permitted subset of dependencies. `denyPatterns` forbids specific dependencies. When both are present, `denyPatterns` further filters within the subset permitted by `allowPatterns`.

Workspace Patterns are used to match workspaces.

### mergeWorkspaceConfig

`mergeWorkspaceConfig` merges multiple workspace configs left to right. Arrays (`alias`, `tags`, `allowPatterns`, `denyPatterns`) are concatenated and deduplicated. Scalar fields later wins. `scripts` are deep-merged per key. Any argument may be a factory function `(prev: WorkspaceConfig) => WorkspaceConfig`.

```ts
import { mergeWorkspaceConfig } from "pacwich/config";

export default mergeWorkspaceConfig(
  { alias: "a", tags: ["x"] },
  { alias: "b", scripts: { build: { order: 1 } } },
  (prevConfig) => ({ tags: ["y"] }),
);
// result: { alias: ["a", "b"], tags: ["x", "y"], scripts: { build: { order: 1 } } }
```

## Workspace Pattern Configs

The project config's `workspacePatternConfigs` field applies workspace configs to groups of workspaces matched by [workspace patterns](/concepts/workspace-patterns). Entries are applied in order, left to right.

Each entry's `config` is merged into the accumulated config of all matching workspaces using the same semantics as `mergeWorkspaceConfig`. The local workspace config (from `pacwich.workspace.*` or the `pacwich` key in `package.json`) is always the starting base.

Pattern matching reflects the accumulated state: aliases and tags added by earlier entries are visible to later entries' patterns.

```ts
import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
  workspacePatternConfigs: [
    {
      patterns: ["path:packages/apps/**/*"],
      config: { tags: ["app"] },
    },
    {
      // "tag:app" matches because the entry above added it
      patterns: ["tag:app"],
      config: {
        rules: { workspaceDependencies: { allowPatterns: ["tag:lib"] } },
      },
    },
    {
      patterns: ["tag:app"],
      // Factory form: JS/TS only. Receives static workspace data and accumulated config.
      config: (workspace, prevConfig) => ({
        alias: workspace.name.replace(/^@my-scope\//, ""),
      }),
    },
  ],
});
```

### Factory function context (`RawWorkspace`)

The factory `(workspace: RawWorkspace, prevConfig: ResolvedWorkspaceConfig) => WorkspaceConfig` receives:

- `workspace.name` — package name from package.json
- `workspace.isRoot` — whether this is the root workspace
- `workspace.path` — relative path from project root
- `workspace.matchPattern` — glob from the project's workspaces declaration that matched (root `package.json.workspaces`, or `pnpm-workspace.yaml` under pnpm)
- `workspace.scripts` — sorted list of script names from package.json
- `workspace.dependencies` — names of workspace dependencies
- `workspace.dependents` — names of workspaces that depend on this one

`prevConfig` is the fully resolved workspace config at that point, including the local config and any configs applied by earlier pattern entries. It has `aliases: string[]`, `tags: string[]`, `scripts: Record<string, ScriptConfig>`, `rules: WorkspaceRules`, `defaultInputs?: WorkspaceInputsConfig`.

## TypeScript/JSON Config Files

### TypeScript

`pacwich.workspace.ts`

```ts
import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  alias: "my-alias",
  tags: ["my-tag"],
});
```

`pacwich.project.ts`

```ts
import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
  packageManager: "pnpm",
  defaults: {
    parallelMax: 5,
  },
});
```

<!--End pacwich config-->
