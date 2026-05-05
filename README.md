<a href="https://bunworkspaces.com">
<img src="./workspaces/web/documentation-website/src/pages/public/images/png/bwunster-bg-banner-wide_3000x900.png" alt="bun-workspaces" width="100%" />
</a>

<br/>

Full Documentation: [https://bunworkspaces.com](https://bunworkspaces.com)

Changelog: [GitHub Releases](https://github.com/bun-workspaces/bun-workspaces/releases)

# bun-workspaces

A [monorepo](http://sonarsource.com/resources/library/monorepo/) tool that enhances native [Bun workspaces](https://bun.sh/docs/install/workspaces).

- Works right away, with **no boilerplate required** 🍽️
- Get **rich metadata** about your monorepo 🤖
- **Orchestrate** your workspaces' package.json scripts 🎻
- Run one-off [**Bun Shell**](https://bun.com/docs/runtime/shell) commands in your workspaces 🐚
- Use with Bun as your package manager for **Node** projects 🎁
- Use the [MCP server](https://bunworkspaces.com/ai/mcp) to make your AI tooling aware of `bun-workspaces` and its documentation resources! 🛠️

To get started, all you need is a repo using Bun's workspaces feature for nested JavaScript/TypeScript packages. This adds enhanced features on top of plain workspaces.

Start running some [CLI commands](https://bunworkspaces.com/cli) right away in your repo, or take full advantage of the [TypeScript API](https://bunworkspaces.com/api) and its features.

This package is unopinionated and works with any project structure you want. Think of this as a power suit you can snap onto native workspaces, rather than whole new monorepo framework.

## Quick Start

Installation:

```bash
$ # Install to use the API and/or lock your CLI version for your project
$ bun add --dev bun-workspaces
$ # Start using the CLI with or without the installation step
$ bunx bun-workspaces --help
```

Note that you need to run `bun install` in your project for `bun-workspaces` to find your project's workspaces. This is because it reads `bun.lock`. This also means that if you update your workspaces, such as changing their name, you must run `bun install` for the change to reflect.

### CLI

[Full CLI documentation here](https://bunworkspaces.com/cli)

```bash
# You can add this to .bashrc, .zshrc, or similar.
# You can also invoke "bw" in your root package.json scripts.
alias bw="bunx bun-workspaces"

# List all workspaces in your project
bw list-workspaces

# ls is an alias for list-workspaces
bw ls --json --pretty # Output as formatted JSON

# Get info about a workspace
bw workspace-info my-workspace
bw info my-workspace --json --pretty # info is alias for workspace-info

# Get info about a script, such as the workspaces that have it
bw script-info my-script

# Run the lint script for all workspaces
# that have it in their package.json "scripts" field
bw run-script lint

# run is an alias for run-script
bw run lint my-workspace # Run for a single workspace
bw run lint my-workspace-a my-workspace-b # Run for multiple workspaces
bw run lint my-alias-a my-alias-b # Run by alias (set by optional config)

# A workspace's script will wait until any workspaces it depends on have completed
# Similar to Bun's --filter behavior
bw run lint --dep-order

# Continue running scripts even if a dependency fails
bw run lint --dep-order --ignore-dep-failure

bw run lint "my-workspace-*" # Run for matching workspace names
bw run lint "alias:my-alias-*" "path:my-glob/**/*" "tag:my-tag" # Use matching specifiers
bw run lint "*" "not:path:my-path/*" # Run for all workspaces not in my-path/

bw run lint --args="--my-appended-args" # Add args to each script call
bw run lint --args="--my-arg=<workspaceName>" # Use the workspace name in args

bw run "bun build" --inline # Run an inline command via the Bun shell

# Scripts run in parallel by default
bw run lint --parallel=false # Run in series
bw run lint --parallel=2 # Run in parallel with a max of 2 concurrent scripts
bw run lint --parallel=auto # Default, based on number of available logical CPUs
bw run lint --parallel=50% # Run in parallel with a max of 50% of the "auto" limit

# Use the grouped output style (default when on a TTY)
bw run my-script --output-style=grouped

# Set the max preview lines for script output in grouped output style
bw run my-script --output-style=grouped --grouped-lines=auto
bw run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
bw run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
bw run my-script --output-style=plain

# Silence all output of the run command
bw --log-level=silent run my-script --output-style=none

# Show usage (you can pass --help to any command)
bw help
bw --help

# Show version
bw --version

# Pass --cwd to any command
bw --cwd=/path/to/your/project ls
bw --cwd=/path/to/your/project run my-script

# Pass --log-level to any command (debug, info, warn, error, or silent)
bw --log-level=debug ls
```

### API

[Full API documentation here](https://bunworkspaces.com/api)

```typescript
import { createFileSystemProject } from "bun-workspaces";

// A Project contains the core functionality of bun-workspaces.
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

    // Optional. Whether to ignore all output from the script.
    // This saves memory when you don't need script output.
    ignoreOutput: false,
  });

  // Get a stream of the script subprocess's output
  for await (const { chunk, metadata } of output.text()) {
    // console.log(chunk); // The output chunk's content (string)
    // console.log(metadata.streamName); // The output stream, "stdout" or "stderr"
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

// Run a script in all workspaces that have it in their package.json "scripts" field
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

    // Optional. Whether to run the scripts in parallel (default: true)
    parallel: true,

    // Optional. When true, a workspace's script will wait
    // until any workspaces it depends on have completed
    dependencyOrder: false,

    // Optional. When true and dependencyOrder is true,
    // continue running scripts even if a dependency fails
    ignoreDependencyFailure: false,

    // Optional. Whether to ignore all output from the scripts.
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
    // console.log(metadata.workspace); // the Workspace that the output came from
  }

  // Get final summary data and script exit details after all scripts have completed
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

### Configuration

`bun-workspaces` has no required configuration, but there are optional config files.

#### Workspace Config

Workspace configs can be placed in a workspace's directory at `bw.workspace.ts`.

[Workspace configuration documentation here](https://bunworkspaces.com/config/workspace)

```typescript
// bw.workspace.ts — place in a workspace directory

// Also supported: bw.workspace.js, bw.workspace.json, bw.workspace.jsonc,
// or a "bw" key in package.json

import { defineWorkspaceConfig } from "bun-workspaces/config";

export default defineWorkspaceConfig({
  alias: "my-web-app", // shorthand name; use array for multiple
  tags: ["app", "frontend"],
  scripts: {
    // lower order runs first in sequenced script execution
    build: { order: 1 },
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

#### Root Config

A root config can be placed in the project root directory at `bw.root.ts`,
which can also apply workspace configs in bulk by using workspace patterns.

[Root configuration documentation here](https://bunworkspaces.com/config/root)

[More on workspace pattern configs here](https://bunworkspaces.com/config/workspace-pattern-configs)

```typescript
// bw.root.ts — place in your project root directory
// Also supported: bw.root.js, bw.root.json, bw.root.jsonc,
// or a "bw-root" key in package.json

import { defineRootConfig } from "bun-workspaces/config";

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

_`bun-workspaces` is independent from the [Bun](https://bun.sh) project and is not affiliated with or endorsed by Anthropic. This project aims to enhance the experience of Bun for its users._

Developed By:

<a href="https://smorsic.io" target="_blank" rel="noopener noreferrer">
  <img src="./workspaces/web/documentation-website/src/pages/public/images/png/smorsic-banner_light_803x300.png" alt="Smorsic Labs logo" width="280" />
</a>
