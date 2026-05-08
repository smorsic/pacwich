## Project Overview

bun-workspaces is a CLI and TypeScript API to help manage Bun monorepos. It reads `bun.lock` to find all workspaces in the project. It is referred to as "bw" for short, which is also the recommended CLI alias. The overall goal is a monorepo tool that is more lightweight than others, with still powerful comparable features, requiring no special config to get started, only a standard Bun repo using workspaces.

Three main domain terms to know:

- Project: generally represents a monorepo and is defined by the root `package.json` file
- Workspace: a nested package within a project. The root package.json can count as a workspace as well, but by default, only nested packages are considered workspaces.
- Script: an entry in the `scripts` field of a workspace's `package.json` file. bw can also run one-off commands known as "inline scripts," which can use the Bun shell or system shell (`sh -c` or `cmd /d /s /c` for windows).

bw also supports **affected workspace** detection: given a set of changed files (from a git diff or an explicit list), it determines which workspaces are meaningfully changed. This drives `bw list-affected`/`bw run-affected` for orchestrating builds, tests, etc. across only the workspaces that need them.

## Concepts

### Workspace patterns

Many features accept a list of workspace patterns to match a subset of workspaces.

By default, a pattern matches the workspace name or alias: `my-workspace-name` or `my-alias-name`. Aliases are defined in config explained below.

Patterns can include a wildcard to match only by workspace name: `my-workspace-*`.

- Alias pattern specifier: `alias:my-alias-*`.
- Path pattern specifier (supports glob): `path:packages/**/*`.
- Name pattern specifier: `name:my-workspace-*`.
- Tag pattern specifier: `tag:my-tag`.
- Special root workspace selector: `@root`.
- Any pattern can start with `not:` to negate the pattern. (e.g. "not:my-workspace-name", "not:tag:my-tag-\*") This excludes workspaces that match any other present patterns from a result.

### Workspace Script Metadata

Scripts ran via bun-workspaces can access metadata about the workspace, script, and project
via env vars. This same metadata can also be interpolated into inline scripts and appended args.

```typescript
// in a workspace's script invoked by bun-workspaces using a metadata function
import { getWorkspaceScriptMetadata } from "bun-workspaces/script";

// Use the helper within a script that was invoked via bun-workspaces
const projectPath = getWorkspaceScriptMetadata("projectPath");
const projectName = getWorkspaceScriptMetadata("projectName");
const workspaceName = getWorkspaceScriptMetadata("workspaceName");
const workspacePath = getWorkspaceScriptMetadata("workspacePath");
const workspaceRelativePath = getWorkspaceScriptMetadata(
  "workspaceRelativePath",
);
const scriptName = getWorkspaceScriptMetadata("scriptName");
```

```typescript
// In a script, but accessing the same data via plain environment variables (same values as previous example)
const projectPath = process.env.BW_PROJECT_PATH;
const workspaceName = process.env.BW_WORKSPACE_NAME;
const workspacePath = process.env.BW_WORKSPACE_PATH;
const workspaceRelativePath = process.env.BW_WORKSPACE_RELATIVE_PATH;
const scriptName = process.env.BW_SCRIPT_NAME;
```

```bash
# interpolated
bw run "bun <projectPath>/my-script.ts" --inline \
  --inline-name="my-script-name" \
  --args="<workspaceName> <workspacePath>"
```

### Affected workspaces

A workspace is "affected" when something in its set of **inputs** has changed. Inputs default to:

- Files in the workspace's directory (only git-trackable files; the default file pattern is `"."`)
- Workspace dependencies — if a workspace dep is affected for any reason, dependents cascade as affected
- All non-workspace dependencies declared in its `package.json` (across all four maps: `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`). Version changes are detected by diffing resolved versions in `bun.lock`. For `peerDependencies`/`optionalDependencies`, lockfile presence is the gate — an unresolved optional (e.g., a platform-skipped native binding) emits no change.

Inputs are configurable per workspace (`defaultInputs`) and per script (`scripts[name].inputs`):

- `files`: file/dir/glob patterns relative to the workspace. Leading `/` makes a pattern relative to the project root. Prefix `!` to exclude. Only git-trackable files match.
- `workspacePatterns`: workspace patterns whose matched workspaces are treated as inputs (like dependencies, but without needing a real `package.json` dep).
- `externalDependencies`: an allowlist of package names. Omitted = all external deps participate; `[]` = none participate; non-empty = only listed names participate (intersected with the workspace's actual external deps).

There are two diff sources:

- **git** (default): diff `HEAD` against the configured base ref (default `main`, configurable via `affectedBaseRef` in the root config or `BW_AFFECTED_BASE_REF_DEFAULT` env var). Uncommitted changes (staged, unstaged, untracked) are included by default. Gitignored files never participate.
- **fileList**: pass changed files explicitly (paths, dirs, or globs) — bypasses git entirely.

Use `--explain` for a per-workspace summary of changed inputs and dep cascade reasons, and `--explain --detailed` for full per-file/edge breakdowns including the affected-dep chain.

### CLI examples:

```bash
alias bw="bunx bun-workspaces"

bw list-workspaces # human-readable output
bw ls --json --pretty # ls is alias for list-workspaces
bw ls "name:my-workspace-*" "alias:my-alias-*" "path:packages/**/*" # accepts workspace patterns

# info includes the name, aliases, path, etc.
bw workspace-info my-workspace
bw info my-workspace --json --pretty # info is alias for workspace-info

# info includes the script name and workspaces that have it in their package.json "scripts" field
bw script-info my-script --json --pretty

# run the package.json "lint" script for all workspaces that have it
bw run-script lint

# run is alias for run-script
# run the package.json "lint" script for workspaces using matching specifiers
bw run lint my-workspace-name "alias:my-alias-pattern-*" "path:my-glob/**/*" # accepts workspace patterns

# A workspace's script will wait until any workspaces it depends on have completed
# Similar to Bun's --filter behavior
bw run lint --dep-order

# Continue running scripts even if a dependency fails
bw run lint --dep-order --ignore-dep-failure

# special root workspace selector (works even if root workspace is not included)
bw run lint @root

# Scripts run in parallel by default
bw run lint --parallel=false # Run in series

# Default can be overridden by config or env var BW_PARALLEL_MAX_DEFAULT
bw run lint --parallel # default "auto", os.availableParallelism()
bw run lint --parallel=2 # Run in parallel with a max of 2 concurrent scripts
bw run lint --parallel=50% # 50% of os.availableParallelism()
bw run lint --parallel=unbounded # run all in one batch

# add args to the script command
bw run lint --args="--my-arg=value"
bw run lint --args="--my-arg=<workspaceName>" # use the workspace name in args

# run the script as an inline command from the workspace directory
bw run "bun build" --inline
bw run "bun build" --inline --inline-name="my-script"
bw run "bun build" --inline --shell=system # use the system shell

# Use the grouped output style (default when on a TTY)
bw run my-script --output-style=grouped

# Set the max preview lines for script output in grouped output style
bw run my-script --output-style=grouped --grouped-lines=auto
bw run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
bw run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
bw run my-script --output-style=plain

# List affected workspaces (default: git diff HEAD vs the configured base ref, "main" by default)
bw list-affected
bw ls-affected # alias

# Compare specific git refs
bw ls-affected --base=my-branch-a --head=my-branch-b
bw ls-affected -B my-branch-a -H my-branch-b # short forms

# Resolve inputs for a specific script (uses scripts[name].inputs when configured)
bw ls-affected --script=build

# Ignore some uncommitted changes (uncommitted included by default)
bw ls-affected --ignore-uncommitted # all of: staged, unstaged, untracked
bw ls-affected --ignore-untracked
bw ls-affected --ignore-unstaged
bw ls-affected --ignore-staged

# Skip workspace dep cascade (only direct file/external-dep changes flag a workspace)
bw ls-affected --ignore-workspace-deps

# Skip lockfile-based external dep version tracking
bw ls-affected --ignore-external-deps

# Bypass git entirely with an explicit list of changed files
# (paths, dirs, globs; '!' to exclude; whitespace-separated)
bw ls-affected --files="packages/example/**/*.ts packages/example/my-file.json"
bw ls-affected -F "packages/a/**/*.ts !packages/a/**/*.test.ts"

# Per-workspace summary of why each workspace is affected
bw ls-affected --explain
bw ls-affected -e

# Full per-file changes and dep cascade chain for each affected workspace
bw ls-affected --explain --detailed
bw ls-affected -e -D

# JSON output (with --explain produces the full result object)
bw ls-affected --json --pretty
bw ls-affected --explain --json --pretty

# Run a script across affected workspaces (accepts the same affected options
# as ls-affected, plus the same script-execution options as run-script:
# --parallel, --dep-order, --args, --output-style, --inline, etc.)
bw run-affected build
bw run-affected build --base=my-branch --ignore-uncommitted --dep-order
bw run-affected build --files="packages/a/src/**/*.ts" --parallel=2
bw run-affected "bun build" --inline --inline-name=build # inline command form

### Global Options ###
# Root directory of project:
bw --cwd=/path/to/project ls
bw -d /path/to/project ls

# Include root workspace as a normal workspace (default false):
bw --include-root ls
bw -r ls
bw --no-include-root ls # override config/env var setting

# Log level (debug|info|warn|error|silent, default info)
bw --log-level=silent ls
bw -l silent ls
```

### API examples:

The API is held in close parity with the CLI. It is developed first so that the CLI is a thin wrapper around the API.

```typescript
import { createFileSystemProject } from "bun-workspaces";

const project = createFileSystemProject({
  // the options object itself and its properties are optional
  rootDirectory: "path/to/your/project",
  includeRootWorkspace: false,
});
project.workspaces; // array of all workspaces in the project
project.rootWorkspace; // the root workspace (available even when not included in the workspaces array)
project.findWorkspaceByName("my-workspace"); // find a workspace by name
project.findWorkspaceByAlias("my-alias"); // find a workspace by alias
project.findWorkspaceByNameOrAlias("my-workspace-or-alias"); // find a workspace by name or alias
project.findWorkspacesByPattern(
  "my-workspace-name",
  "my-workspace-alias",
  "my-name-pattern-*",
  "alias:my-alias-*",
  "path:my-glob/**/*",
); // find workspaces by pattern like the CLI
project.runWorkspaceScript({
  workspaceNameOrAlias: "my-workspace",
  script: "lint",
  inline: true,
  // args can be a string or an array of strings
  // if string, the argv will be parsed POSIX-style
  args: "--my-arg=value",
});
project.runScriptAcrossWorkspaces({
  script: "lint",
  workspacePatterns: [
    "alias:my-alias-pattern-*",
    "path:my-glob/**/*",
    "workspace-name-a",
    "workspace-alias-b",
  ],
  parallel: true, // also could be { max: 2 }, max taking same options as seen in CLI examples above (e.g. "50%", "auto", etc.)
  dependencyOrder: true,
  ignoreDependencyFailure: true,
  // same as for runWorkspaceScript
  args: ["--my", "--appended", "--args"],
  // Optional, callback when script starts, skips, or exits
  onScriptEvent: (event, { workspace, exitResult }) => {
    // event: "start", "skip", "exit"
  },
});

// Determine affected workspaces — git mode (default)
project.determineAffectedWorkspaces({
  diffSource: "git",
  // optional: resolve inputs for a specific script (uses scripts[name].inputs)
  script: "build",
  // optional: skip workspace dep cascade
  ignoreWorkspaceDependencies: false,
  // optional: skip lockfile-based external dep version tracking
  ignoreExternalDependencies: false,
  diffOptions: {
    baseRef: "main", // default from config / "main"
    headRef: "HEAD", // default
    ignoreUncommitted: false, // staged + unstaged + untracked
    ignoreUntracked: false,
    ignoreUnstaged: false,
    ignoreStaged: false,
  },
});

// Determine affected workspaces — fileList mode (bypass git)
project.determineAffectedWorkspaces({
  diffSource: "fileList",
  // paths, directories, or globs (relative to project root); '!' to exclude
  changedFiles: ["packages/a/**/*.ts", "!packages/a/**/*.test.ts"],
});

// Run a script across affected workspaces. Accepts the same affected options
// as determineAffectedWorkspaces, plus the script-execution options from
// runScriptAcrossWorkspaces (parallel, dependencyOrder, args, onScriptEvent, etc.).
project.runAffectedWorkspaceScript({
  script: "build",
  diffSource: "git",
  diffOptions: { baseRef: "main", ignoreUncommitted: true },
  parallel: { max: 2 },
  dependencyOrder: true,
  ignoreDependencyFailure: true,
});
```

## The Workspace object

```jsonc
{
  // The name of the workspace from its package.json
  "name": "my-workspace",
  // Whether the workspace is the root workspace
  "isRoot": false,
  // The relative path to the workspace from the project root
  "path": "my/workspace/path",
  // The glob pattern from the root package.json "workspaces" field
  // that this workspace was matched from
  "matchPattern": "my/workspace/pattern/*",
  // The scripts available in the workspace's package.json
  "scripts": ["my-script"],
  // Aliases defined in workspace configuration (bw.workspace.jsonc/bw.workspace.json)
  "aliases": ["my-alias"],
  // Tags defined in workspace configuration
  "tags": ["my-tag"],
  // Names of other workspaces that this workspace depends on
  "dependencies": ["my-dependency"],
  // Names of other workspaces that depend on this workspace
  "dependents": ["my-dependent"],
  // Non-workspace package deps declared in package.json (across all four maps).
  // `source` is one of "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies".
  // `version` is the package.json range, with `catalog:`/`catalog:<name>` resolved when possible.
  // `catalog` is present when declared via a catalog ref.
  "externalDependencies": [
    { "name": "lodash", "version": "^4.17.0", "source": "dependencies" },
    { "name": "typescript", "version": "^5.0.0", "source": "devDependencies" },
    {
      "name": "react",
      "version": "^18.0.0",
      "source": "dependencies",
      "catalog": { "name": "" },
    },
  ],
}
```

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

## Development processes

Most work happens in the workspace at `workspaces/packages/bun-workspaces`, the main npm package source. This
is the assumed default location for development.

The next most commonly developed workspace is `workspaces/web/documentation-website`, the documentation website.

Useful development commands:

- Format via prettier: `bun format`
- Run tests: `bun bw:test`
- Run test that matches a pattern: `bun bw:test myFilePattern`
- Run rslib build: `bun bw:build`
- Lint the package: `bun bw:lint`
- Lint the documentation website: `bun docs:lint`

## Coding style

TypeScript is written in a generally functional/procedural style. Patterns in general in this project should remain fairly consistent but are not dogmatic, as will be explained below.

Class-based patterns are seen but are not the default, such as the `Project` class, which encapsulates composable operations, since context of most of bw's functionality depends on the state of a given project. Classes are still abstracted away, such as how `Project`s are usually instantiated via `createFileSystemProject()`.

The `Workspace` objects are a plain JSON-serializable objects to prevent complex class structures and maintain a functional-like style that generally separates process from data within the project context. Many generic utilities on top of workspaces are written as plain functions and then incorporated into a `Project`'s implementation details.

### Packaging

Feature packaging is preferred over layer packaging. The `src/internal/` directory leans more towards layer packaging for generic utilities.

Module directories often contain an `index.ts` that simply uses `export *` for all files and subdirectories. However, `src/index.ts` defines the public-facing API, so this is where exports must be defined only explicitly.

### Naming and language features

Variable names are camelCase and longer descriptive names are preferred over abbreviations. Functions should generally use a verb. Booleans read as a question, often using `is` or `has` prefix etc. SCREAMING_SNAKE_CASE is used for top-level constants and environment variables.

Arrow functions are preferred, and a single object parameter is generally preferred over multiple parameters. Inline types are not encouraged, with a preference of a named type for object parameters and return types, so that these types can be reused and potentially exported.

Object destructuring is encouraged.

Don't use TypeScript `enum`s but prefer plain objects.

### Style example:

This example shows some common patterns used when a set of accepted values is needed. The main idea here is that the structure of this code is DRY and self-validating, since the `MyValue` type is inferred directly from the concrete `MY_VALUES` array, which is the one source of truth for both the type and runtime values. The `MY_BEHAVIOR_MAP` ensures each value has a handler when this type of branched logic is needed instead of using `switch`. Other modules importing from this can use the parameter and return types for `handleMyValue` as needed when composing logic.

```typescript
export const MY_VALUES = ["a", "b", "c"] as const;

export type MyValue = (typeof MY_VALUES)[number];

/** Description of the purpose of the options */
export type MyFunctionOptions = {
  /** The value to handle */
  value: MyValue;
  /** An optional flag */
  isSomething?: boolean;
};

/** Description of the purpose of the result */
export type MyFunctionResult = {
  /** Whether the operation was successful */
  success: boolean;
};

const MY_BEHAVIOR_MAP: Record<
  MyValue,
  (options: MyFunctionOptions) => MyFunctionResult
> = {
  a: ({ isSomething }) => {
    console.log("a", isSomething);
    return { success: true };
  },
  b: ({ isSomething }) => {
    console.log("b", isSomething);
    return { success: true };
  },
  c: ({ isSomething }) => {
    console.log("c", isSomething);
    return { success: true };
  },
};

/** Description of the purpose of the function */
export const handleSomething = (options: MyFunctionOptions): MyFunctionResult =>
  MY_BEHAVIOR_MAP[options.value](options);

// Example usage
const { success } = handleSomething({ value: "a", isSomething: true });
```

### Testing practices

Except when unreasonably complex to test, generally speaking, all feature additions and fixes should include tests. This means that all CLI commands and their options that can be passed should be verified.

Testing both and API feature and the CLI version of it is necessary to ensure that arguments etc. are handled correctly in both places. It may often make sense to do the most exhaustive behavior testing on the API and then ensure the CLI passes all options correctly to this API more simply, but without making too much assumption that the CLI "must be fine" just because the API does.

Sometimes important internals (like the generic `runScripts` function) are tested to ensure the core logic driving features work, even if they aren't exposed publicly, which can help with diagnosing issues and making more focused logic tests that require less boilerplate/setup.

#### Test cases

Test cases should be written at the very minimum for the following:

- CLI feature:
  - At least one case per form of command (e.g. if short form is provided)
  - At least one case per positional or flag option, again with at least one per arg/option form
  - If option takes specific values, one case per value, and at least one case of an unsupported value error
  - If option takes multiple types (e.g. number or freeform string), one per type, and at least one for an invalid type
  - Any command strings that would result in a CLI-specific error for the feature
  - When many options/args possible, the different combinations of how these could be passed together

- API feature:
  - Similar to CLI: at least one case per arg/option, cases per arg value and/or type, cases per invalid arg, and cases for combinations of args/options
  - Cases for errors thrown when args/options are passed that violate a TS type are only needed for public APIs (internal utilities can rely on source TS compile check, while public surface could be used by JS package user)

- Other (general):
  - Array-like arguments/options: cases for empty array, single item array, multi-item array (2 and more). When items can be multiple types, similar cases for different types and combinations of different types
  - Cases using real test projects that change behavior or surface potential edge cases
  - There don't need to necessarily be combinations/permutations of every single case requirement described here, just enough for confidence in each situation.
  - Since most features are developed in the API followed by the CLI acting as a wrapper over the API, the API surface can be used to put a feature through the wringer the most, while the CLI should be as complete as described above but can be tested just to the point of confirmation of successful API passthrough of all options.
