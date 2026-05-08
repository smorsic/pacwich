## Root config

Optional project config can be placed in `bw.root.ts`/`bw.root.js`/`bw.root.jsonc`/`bw.root.json` in the root directory, or in the `"bw"` key of `package.json`.

Config defaults here take precedence over environment variables. Explicit CLI arguments or API options take precedence over all other settings.

```jsonc
{
  "defaults": {
    "parallelMax": 5, // same options as seen in CLI examples above
    "shell": "system", // "bun" or "system" (default "bun")
    "includeRootWorkspace": true, // treat root package.json as a normal workspace
    "affectedBaseRef": "main", // default git base ref for affected resolution (env: BW_AFFECTED_BASE_REF_DEFAULT)
  },
  "workspacePatternConfigs": [
    // see Workspace Pattern Configs section below
  ],
}
```

### mergeRootConfig

`mergeRootConfig` merges multiple root configs left to right. Later configs take precedence for scalar fields. `workspacePatternConfigs` entries are concatenated. Any argument may be a factory function `(prev: RootConfig) => RootConfig`.

```ts
import { mergeRootConfig } from "bun-workspaces/config";

export default mergeRootConfig(
  { defaults: { parallelMax: 4 } },
  { defaults: { shell: "system" } },
  (prevConfig) => ({ defaults: { includeRootWorkspace: true } }),
);
```

## Workspace config

Optional config can be placed in `bw.workspace.ts`/`bw.workspace.js`/`bw.workspace.jsonc`/`bw.workspace.json` in a workspace directory, or in the `"bw"` key of `package.json`.

Aliases must be unique to each workspace and must not clash with other workspaces' `package.json` names.

Tags are strings to group workspaces together; they do not need to be unique.

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

Per-script `inputs` fully replaces `defaultInputs` for that script — the two are not merged. If a script has its own `inputs` field, `defaultInputs` is ignored for that script.

### Workspace Dependency Rules

Using the `rules.workspaceDependencies` field, you can define rules for which workspaces are allowed to be dependencies, using `allowPatterns`, `denyPatterns`, or both.

`allowPatterns` defines the permitted subset of dependencies. `denyPatterns` forbids specific dependencies. When both are present, `denyPatterns` further filters within the subset permitted by `allowPatterns`.

Workspace Patterns are used to match workspaces.

### mergeWorkspaceConfig

`mergeWorkspaceConfig` merges multiple workspace configs left to right. Arrays (`alias`, `tags`, `allowPatterns`, `denyPatterns`) are concatenated and deduplicated. Scalar fields later wins. `scripts` are deep-merged per key. Any argument may be a factory function `(prev: WorkspaceConfig) => WorkspaceConfig`.

```ts
import { mergeWorkspaceConfig } from "bun-workspaces/config";

export default mergeWorkspaceConfig(
  { alias: "a", tags: ["x"] },
  { alias: "b", scripts: { build: { order: 1 } } },
  (prevConfig) => ({ tags: ["y"] }),
);
// result: { alias: ["a", "b"], tags: ["x", "y"], scripts: { build: { order: 1 } } }
```

## Workspace Pattern Configs

The root config's `workspacePatternConfigs` field applies workspace configs to groups of workspaces matched by [workspace patterns](/concepts/workspace-patterns). Entries are applied in order, left to right.

Each entry's `config` is merged into the accumulated config of all matching workspaces using the same semantics as `mergeWorkspaceConfig`. The local workspace config (from `bw.workspace.*` or `package.json`) is always the starting base.

Pattern matching reflects the accumulated state: aliases and tags added by earlier entries are visible to later entries' patterns.

```ts
import { defineRootConfig } from "bun-workspaces/config";

export default defineRootConfig({
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
      // Factory form: JS/TS only — receives static workspace data and accumulated config
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
- `workspace.matchPattern` — glob from root package.json `workspaces` field that matched
- `workspace.scripts` — sorted list of script names from package.json
- `workspace.dependencies` — names of workspace dependencies
- `workspace.dependents` — names of workspaces that depend on this one

`prevConfig` is the fully resolved workspace config at that point, including the local config and any configs applied by earlier pattern entries. It has `aliases: string[]`, `tags: string[]`, `scripts: Record<string, ScriptConfig>`, `rules: WorkspaceRules`, `defaultInputs?: WorkspaceInputsConfig`.

## TypeScript/JSON Config Files

### TypeScript

`bw.workspace.ts`

```ts
import { defineWorkspaceConfig } from "bun-workspaces/config";

export default defineWorkspaceConfig({
  alias: "my-alias",
  tags: ["my-tag"],
});
```

`bw.root.ts`

```ts
import { defineRootConfig } from "bun-workspaces/config";

export default defineRootConfig({
  defaults: {
    parallelMax: 5,
  },
});
```
