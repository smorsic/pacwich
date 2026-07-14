<a href="https://pacwich.dev">
<img src="./workspaces/web/documentation-website/src/pages/public/images/png/bwunster-pacwich-subtitled-wide_1400x400.png" alt="pacwich logo" width="100%" />
</a>

<br/>

# pacwich

<sub>Latest: 0.5.0</sub>

Monorepo tooling that works on top of **Bun**, **npm**, and **pnpm** workspaces. Zero config required. [AI-friendly](https://pacwich.dev/ai) and human-friendly documentation. Has an [affected graph](https://pacwich.dev/concepts/affected) and [rules for workspace code sharing](https://pacwich.dev/config/workspace#workspace-dependency-rules). Comes with a CLI and TypeScript API.

To get started, all you need is a repo using workspaces for nested JavaScript/TypeScript packages. This adds enhanced features on top of plain workspaces, like getting metadata about the monorepo and running scripts across workspaces.

Start running some [CLI commands](https://pacwich.dev/cli) right away in your repo, or take full advantage of the [TypeScript API](https://pacwich.dev/api) and its features.

**Full Documentation**: [https://pacwich.dev](https://pacwich.dev)

- [Overview page](https://pacwich.dev/intro/overview)
- [Getting Started Guide](https://pacwich.dev/intro/getting-started)
- Changelog: [GitHub Releases](https://github.com/smorsic/pacwich/releases)

### Terminology

The definitions of **workspace** and **project** differ between package managers and monorepo tooling.

In `pacwich`, the word **workspace** is closer to how it's used in **npm** and **Bun**, a **workspace** being a **nested package** in a monorepo. Not necessarily all packages are workspaces, but all workspaces are packages.

The **project** is synonymous with your root where workspaces are defined, often the root of your git repository as well.

This means you have a root **project** that has some number of **workspaces**. The root package is not considered a workspace by default, but [it optionally can be](https://pacwich.dev/concepts/root-workspace).

[Docs: Glossary page](https://pacwich.dev/concepts/glossary)

> #### Note: bun-workspaces
>
> This is the continuation of the `bun-workspaces` package that only worked with Bun.
> See the [migration guide](https://pacwich.dev/intro/bun-workspaces-migration) for more information. [Read the blog post](https://smorsic.io/blog/pacwich-launch) about motivations and development strategy.
>
> You can also instruct an agent to read `https://pacwich.dev/intro/bun-workspaces-migration/index.md`
> to assist with migration.
>
> Thanks to most core code and tests carrying over from `bun-workspaces`, `pacwich` inherits its maturity to a large degree.

## Quick Start

### Installation

#### Global CLI

The global install gives you a convenient `pacwich` binary, which will still delegate to a local install's CLI, if available.

```bash
# Use the package manager of your choice:
bun add -g pacwich
# OR
pnpm add -g pacwich
# OR
npm install -g pacwich
```

##### Completions

When using the global install, you can set up shell completions for bash, zsh, or fish.

```bash
# Print help for setting up completions
pacwich completion

# Attempt to automatically install completion for your shell
pacwich completion install
```

#### Local install

Pin the CLI version for your project, and/or use the TypeScript library.

If you only use a local install, you can still invoke the `pacwich` command within `package.json` scripts, potentially using your root `package.json` scripts for common `pacwich` operations
you need in your project.

```bash
# Use the package manager of your choice:
bun add -d pacwich
# OR
pnpm add -D pacwich
# OR
npm install -D pacwich
```

#### Stale workspace data

Note that you need to run your package manager's install for pacwich to have current workspace data available, e.g. via `bun install`, `pnpm install`, or `npm install`. If you've added/removed/updated any workspace package.json, you'll likely need to run this again.

#### Calling the CLI

You might optionally [alias](https://www.geeksforgeeks.org/linux-unix/alias-command-in-linux-with-examples/) your most used invocation to `pw`,
especially if you area `bun-workspaces` user that had a `bw` alias.

```bash
# Use the global command if installed
# This will use a local install's CLI, if available
pacwich --help

# Or use a one-off/local invocation
npx pacwich --help
bunx pacwich --help
pnpm exec pacwich --help
```

### CLI Quickstart

[Full CLI documentation here](https://pacwich.dev/cli)

```bash
##########
# Global #
##########

# Show usage (you can pass --help to any command)
pacwich --help

# Show version
pacwich --version

# Pass --cwd to any command
pacwich --cwd=/path/to/your/project ls
pacwich --cwd=/path/to/your/project run my-script

# Specify package manager, if you have multiple lockfiles
pacwich --pm=pnpm ls

# Pass --log-level to any command (debug, info, warn, error, or silent)
# A default can also be set with the PACWICH_LOG_LEVEL env var (the flag overrides it)
pacwich --log-level=debug ls

# Suppress specific warning messages (can also be set by project config)
# Warning IDs can be seen in warning log prefixes (full list: https://pacwich.dev/config/warnings)
pacwich --suppress-warnings=MultiplePackageManagerLockfiles ls
pacwich --suppress-warnings=MultiplePackageManagerLockfiles,ParallelExceedsAvailableCpus run lint

####################
# Getting metadata #
####################

# List all workspaces in your project
pacwich list-workspaces

# ls is an alias for list-workspaces
pacwich ls --json --pretty # Output as formatted JSON

# Get info about a workspace
pacwich workspace-info my-workspace
pacwich info my-workspace --json --pretty # info is alias for workspace-info

# Get info about a script, such as the workspaces that have it
pacwich script-info my-script

##########
# Verify #
##########

# Check for issues with your project
# Can be useful as your root package.json "prepare" script
# or as a pre-commit hook
pacwich verify

# Fails if workspaces detected that import/export from each other
# without explicit dependency declared in package.json
pacwich verify --strict

###################
# Running scripts #
###################

# Run the lint script for all workspaces in parallel
# that have it in their package.json "scripts" field
pacwich run lint
pacwich run lint my-workspace # Run for a single workspace
pacwich run lint my-workspace-a my-workspace-b # Run for multiple workspaces
pacwich run lint my-alias-a my-alias-b # Run by alias (set by optional config)

# A workspace's script will wait until
# any workspaces it depends on have completed
pacwich run lint --dep-order
pacwich run lint --dep-order --ignore-dep-failure

# Workspace patterns
pacwich run lint "my-workspace-*" # Run for matching workspace names
pacwich run lint "alias:my-alias-*" "path:my-glob/**/*" "tag:my-tag"
pacwich run lint "re:my-name-regex.*" "path:re:my-path-regex.*"
pacwich run lint "*" "not:path:my-path/*" # Run for all workspaces not in my-path/

pacwich run lint --args="--my-appended-args" # Add args to each script call
pacwich run lint --args="--my-arg=<workspaceName>" # Use the workspace name in args

pacwich run "cat package.json" --inline # Run an inline shell command

# Inline scripts can use the Bun shell if Bun is available,
# which is a cross-platform Bash-like shell
# This can be helpful for multi-OS support
pacwich run "cat package.json" --inline --shell=bun

# Scripts run in parallel by default
pacwich run lint --parallel=auto # Default, based on available logical CPUs
pacwich run lint --parallel=false # Run sequentially
pacwich run lint --parallel=2 # 2 max scripts run concurrently
pacwich run lint --parallel=50% # half of available logical CPUs

# Set the max preview lines for script output
# when "grouped" output style is used (the default on TTY)
pacwich run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
pacwich run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
pacwich run my-script --output-style=plain

# Run an interactive script with full stdio, for user input etc.
# Requires a script and one workspace name or alias
# A script only gets a TTY if the caller is a TTY (i.e. not piped or redirected)
pacwich run-interactive my-interactive-script my-workspace-name-or-alias

# ri is an alias for run-interactive
pacwich ri my-interactive-script my-workspace-name-or-alias

# Silence all output
pacwich --log-level=silent run my-script --output-style=none

#####################
# Affected Features #
#####################

# List affected workspaces based on git diff (main vs. HEAD by default)
pacwich affected list

# Set the git base and head for comparison
pacwich affected list --base=my-branch-a --head=my-branch-b

# See detailed reasons for affected workspaces
pacwich affected list --explain --detailed

# Run a script across the workspaces affected by a change
pacwich affected run my-script
pacwich affected run my-script --base=my-branch-a --head=my-branch-b

# Aliases
pacwich affected ls
pacwich af ls
pacwich af run

##########
# Config #
##########

# Commands for pacwich's optional configuration

# Print project and all workspace configs as JSON
pacwich config debug
pacwich config debug --pretty # pretty print JSON

# Print just the project config as JSON
pacwich config debug --project

# Print a single workspace config as JSON
pacwich config debug --workspace=name-or-alias

# Print workspace configs matching a pattern as JSON
pacwich config debug --workspace-patterns="my-pattern-*"
```

### TS API Quickstart

[Full API documentation here](https://pacwich.dev/api)

```typescript
import { createFileSystemProject } from "pacwich";

// A Project contains the core functionality of pacwich.
// Below defaults to process.cwd() for the project root directory
// Pass { rootDirectory: "path/to/your/project" } to use a different root directory
const project = createFileSystemProject();

// A Workspace that matches the name or alias "my-workspace"
const myWorkspace = project.findWorkspaceByNameOrAlias("my-workspace");

// Array of workspaces whose names match the wildcard pattern
const wildcardWorkspaces = project.findWorkspacesByPattern("my-workspace-*");

// Array of workspaces that have "my-script" in their package.json "scripts"
const workspacesWithScript = project.listWorkspacesWithScript("my-script");

// Run a script in a workspace
const runSingleScript = async () => {
  const { output, exit } = project.runWorkspaceScript({
    workspaceNameOrAlias: "my-workspace",
    script: "my-script",

    // Optional. Arguments to add to the command
    // Can be a string or an array of strings
    // If string, the argv will be parsed POSIX-style
    args: ["--my", "--appended", "--args"],

    // Optional (default false). Whether to ignore all output from the script.
    // This saves memory when you don't need script output.
    ignoreOutput: false,

    // Optional (default false). Run the script interactively to accept user input.
    // When true, the script will have access to stdin, stdout, and stderr,
    // and script output cannot be captured. Note that a script only gets a TTY
    // if the caller is a TTY (i.e. not piped or redirected)
    interactive: false,
  });

  // Get a stream of the script subprocess's output
  for await (const { chunk, metadata } of output.text()) {
    // console.log(chunk); // The output chunk's content (string)
    // console.log(metadata.streamName); // "stdout" or "stderr"
    // console.log(metadata.workspace); // The target Workspace
  }

  // Get data about the script execution after it exits
  const exitResult = await exit;

  // exitResult.exitCode // The exit code (number)
  // exitResult.signal // The exit signal (string), or null
  // exitResult.success // true if exit code was 0
  // exitResult.startTimeISO // Start time (string)
  // exitResult.endTimeISO // End time (string)
  // exitResult.durationMs // Duration in milliseconds (number)
  // exitResult.metadata.workspace // The target workspace (Workspace)
};

// Run a script in all workspaces that have it in their package.json "scripts"
const runManyScripts = async () => {
  const { output, summary } = project.runScriptAcrossWorkspaces({
    // Optional. This will run in all matching workspaces that have my-script
    // Accepts same values as the CLI run-script command's workspace patterns
    // When not provided, all workspaces that have the script will be used.
    workspacePatterns: ["my-workspace", "my-name-pattern-*"],

    // Required. The package.json "scripts" field name to run
    script: "my-script",

    // Optional. Arguments to add to the command (same as for runWorkspaceScript)
    args: ["--my", "--appended", "--args"],

    // Optional (default true). Whether to run the scripts in parallel
    parallel: true,

    // Optional (default false). When true, a workspace's script will wait
    // until any workspaces it depends on have completed
    dependencyOrder: false,

    // Optional. When true and dependencyOrder is true,
    // continue running scripts even if a dependency fails
    ignoreDependencyFailure: false,

    // Optional (default false). Whether to ignore all output from the scripts.
    // This saves memory when you don't need script output.
    ignoreOutput: false,

    // Optional, callback when script starts, skips, or exits
    onScriptEvent: (event, { workspace, exitResult }) => {
      // event: "start", "skip", "exit"
    },
  });

  // Get a stream of script output
  for await (const { chunk, metadata } of output.text()) {
    // console.log(chunk); // the output chunk's content (string)
    // console.log(metadata.streamName); // "stdout" or "stderr"
    // console.log(metadata.workspace); // the Workspace of the output
  }

  // Get final summary data and script exit details
  const summaryResult = await summary;

  // summaryResult.totalCount // Total number of scripts
  // summaryResult.allSuccess // true if all scripts succeeded
  // summaryResult.successCount // Number of scripts that succeeded
  // summaryResult.failureCount // Number of scripts that failed
  // summaryResult.startTimeISO // Start time (string)
  // summaryResult.endTimeISO // End time (string)
  // summaryResult.durationMs // Total duration in milliseconds (number)

  // The exit details of each workspace script
  for (const exitResult of summaryResult.scriptResults) {
    // exitResult.exitCode // The exit code (number)
    // exitResult.signal // The exit signal (string), or null
    // exitResult.success // true if exit code was 0
    // exitResult.startTimeISO // Start time (ISO string)
    // exitResult.endTimeISO // End time (ISO string)
    // exitResult.durationMs // Duration in milliseconds (number)
    // exitResult.metadata.workspace // The target workspace (Workspace)
  }
};
```

### Configuration Overview

`pacwich` has no required configuration, but there are optional config files.

#### Workspace Config

Workspace configs can be placed in a workspace's directory at `pacwich.workspace.ts`.

[Workspace configuration documentation here](https://pacwich.dev/config/workspace)

```typescript
// pacwich.workspace.ts — place in a workspace directory

// Also supported: pacwich.workspace.js, pacwich.workspace.json, pacwich.workspace.jsonc,
// or a "pacwich" key in package.json

import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  alias: "my-web-app", // shorthand name; use array for multiple
  tags: ["app", "frontend"],
  // Optional, for configuring affected workspace resolution inputs
  // Applies to all scripts that don't configure their own inputs
  defaultInputs: {
    // File paths, directory paths, or globs relative to the workspace's path.
    // Default is all git-trackable files in the workspace directory.
    files: ["src/**/*.ts", "!src/**/*.test.ts"],
    // Workspaces to treat like dependencies that aren't package.json dependencies
    workspacePatterns: ["tag:lib"],
    // Dependency names (e.g. "react") to treat as dependencies (default: all)
    externalDependencies: ["react"],
  },
  scripts: {
    // lower order runs first in sequenced script execution
    build: {
      // Optional, for setting the default script execution order
      order: 1,
      // Optional, for configuring affected workspace resolution inputs
      // Applies to the build script only
      inputs: { files: ["src/**/*.ts"] },
    },
    test: { order: 2 },
  },
  rules: {
    workspaceDependencies: {
      // Only "my-workspace" or workspaces tagged "lib" are allowed as dependencies
      allowPatterns: ["tag:lib", "my-workspace"],
      // Workspaces tagged "backend" are forbidden as dependencies
      denyPatterns: ["tag:backend"],
    },
  },
});
```

#### Project Config

A project-level config can be placed in the project root directory at `pacwich.project.ts`,
which can also apply workspace configs in bulk by using workspace patterns.

[Project configuration documentation here](https://pacwich.dev/config/project)

[More on workspace pattern configs here](https://pacwich.dev/config/workspace-pattern-configs)

```typescript
// pacwich.project.ts — place in your project root directory
// Also supported: pacwich.project.js, pacwich.project.json, pacwich.project.jsonc,
// or a "pacwich-root" key in package.json

import { defineRootConfig } from "pacwich/config";

export default defineRootConfig({
  defaults: {
    // default value for --parallel option
    parallelMax: 4,
    // default value for --shell option
    shell: "system",
    // default value for global --include-root-workspace option
    includeRootWorkspace: false,
  },

  // Apply workspace configs in bulk by workspace pattern, in order.
  // Each entry merges into matching workspaces' accumulated config.
  // Pattern matching reflects aliases and tags added by earlier entries.
  workspacePatternConfigs: [
    {
      patterns: ["path:packages/apps/**/*"],
      config: { tags: ["app"] },
    },
    {
      patterns: ["path:packages/libs/**/*"],
      config: { tags: ["lib"] },
    },
    {
      // "tag:app" matches because the first entry added it
      patterns: ["tag:app"],
      config: {
        // Inputs always override previous entries instead of deep merging
        defaultInputs: { files: ["src/**/*.ts"] },
        scripts: {
          build: { order: 1, inputs: { files: ["src/**/*.ts"] } },
        },
        rules: {
          workspaceDependencies: {
            allowPatterns: ["tag:lib"], // apps may only depend on libs
          },
        },
      },
    },
    {
      patterns: ["tag:app"],
      // Factory form: receives static workspace data and accumulated config
      config: (workspace, prevConfig) => ({
        alias: workspace.name.replace(/^@my-scope\//, ""),
      }),
    },
  ],
});
```
