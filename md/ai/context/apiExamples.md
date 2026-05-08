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
