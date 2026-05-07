import { ENV_VARS_METADATA } from "../config/envVars";
export * from "./apiQuickStart";

export const CREATE_FS_PROJECT_EXAMPLE = `
import { createFileSystemProject } from "bun-workspaces";

// Root directory defaults to process.cwd()
const defaultProject = createFileSystemProject();

const pathProject = createFileSystemProject({
  rootDirectory: "./path/to/project/root" // relative from process.cwd()
});

// Include the root workspace as a normal workspace (overrides config/env settings)
const projectWithRoot = createFileSystemProject({
  includeRootWorkspace: true,
});

`.trim();

export const CREATE_MEMORY_PROJECT_EXAMPLE = `
import { createMemoryProject } from "bun-workspaces";

const testProject = createMemoryProject({
  rootDirectory: "test-project-directory", // optional
  name: "test-project", // optional
  workspaces: [
    {
      name: "my-test-workspace",
      isRoot: false,
      path: "my/test/workspace/path",
      matchPattern: "my/test/workspace/pattern/*",
      scripts: ["my-test-script"],
      aliases: ["test-alias"],
      dependencies: [],
      dependents: [],
      externalDependencies: [],
    }
  ]
});
`.trim();

export const FIND_WORKSPACE_BY_NAME_EXAMPLE = `
// Find a workspace by its package.json name (or returns null)
const workspace = project.findWorkspaceByName("my-workspace");`.trim();

export const FIND_WORKSPACE_BY_ALIAS_EXAMPLE = `
// Find a workspace by its alias (or returns null)
const workspace = project.findWorkspaceByAlias("my-alias");`.trim();

export const FIND_WORKSPACE_BY_NAME_OR_ALIAS_EXAMPLE = `
// Find a workspace by its package.json name or alias (or returns null)
const workspace = project.findWorkspaceByNameOrAlias("my-workspace");`.trim();

export const FIND_WORKSPACES_BY_PATTERN_EXAMPLE = `
// An array of workspaces whose names match the wildcard pattern
const workspaces = project.findWorkspacesByPattern(
  "my-name-pattern-*",
  "alias:my-alias-*",
  "path:packages/**/*",
);`.trim();

export const LIST_WORKSPACES_WITH_SCRIPT_EXAMPLE = `
// An array of workspaces that have "my-script" 
// in their package.json "scripts" field
const workspaces = project.listWorkspacesWithScript("my-script"));`.trim();

export const LIST_WORKSPACES_WITH_TAG_EXAMPLE = `
// An array of workspaces that have the tag "my-tag".
// Tags are defined in a workspace's configuration file.
const workspaces = project.listWorkspacesWithTag("my-tag");`.trim();

export const MAP_SCRIPTS_TO_WORKSPACES_EXAMPLE = `
// An object mapping all script names to the workspaces 
// that have them in their package.json "scripts" field
const scriptMap = project.mapScriptsToWorkspaces();

// An array of Workspaces
const { workspaces } = scriptMap["my-script"];
`.trim();

export const MAP_TAGS_TO_WORKSPACES_EXAMPLE = `
// An object mapping all tags to the workspaces 
// that have them in their respective configuration.
const tagMap = project.mapTagsToWorkspaces();

// An array of Workspaces
const { workspaces } = tagMap["my-tag"];
`.trim();

export const CREATE_SCRIPT_COMMAND_EXAMPLE = `

// Does not run a script, but provides
// metadata that can be used to do so.
const {
  commandDetails: { command, workingDirectory },
} = project.createScriptCommand({
  scriptName: "my-script",
  workspaceNameOrAlias: "my-workspace",
  method: "cd", // optional, defaults to "cd" (other option "filter")
  args: "--my-appended-args", // optional, append args to the command
});

// A means by which you may actually run the script
const subprocess = Bun.spawn(["sh", "-c", command], {
  cwd: workingDirectory,
});

`.trim();

export const WORKSPACE_EXAMPLE = `
{
  // The name of the workspace from its package.json
  name: "my-workspace",

  // Whether the workspace is the root workspace
  isRoot: false,

  // The relative path to the workspace from the project root
  path: "my/workspace/path",

  // The glob pattern from the root package.json "workspaces" field
  // that this workspace was matched from
  matchPattern: "my/workspace/pattern/*",

  // The scripts available in the workspace's package.json
  scripts: ["my-script"],

  // Aliases defined in workspace configuration (see the Configuration section)
  aliases: ["my-alias"],

  // Tags defined in workspace configuration (see the Configuration section)
  tags: ["my-tag"],

  // Names of other workspaces that this workspace depends on
  dependencies: ["my-dependency"],

  // Names of other workspaces that depend on this workspace
  dependents: ["my-dependent"],

  // Other external dependencies, e.g. lodash, react
  externalDependencies: [
    {
      "name": "lodash",
      "version": "^4.17.21",
      "dev": false // if in devDependencies
    },
  ],
}
`.trim();

export const SET_LOG_LEVEL_EXAMPLE = `
import { setLogLevel } from "bun-workspaces";

setLogLevel("debug");
setLogLevel("info") // default
setLogLevel("warn");
setLogLevel("error") // default when NODE_ENV is "test"
setLogLevel("silent");
`.trim();

export const API_INLINE_NAME_EXAMPLE = `

project.runWorkspaceScript({
  workspaceNameOrAlias: "my-workspace",
  script: "echo 'this is my inline script'",
  // The name will be empty by default
  inline: true,
});

// Pass a name for an inline script
project.runWorkspaceScript({
  workspaceNameOrAlias: "my-workspace",
  script: "echo 'my script: <scriptName>'",
  inline: { scriptName: "my-inline-script" },
});
`.trim();

export const API_PARALLEL_SCRIPTS_EXAMPLE = `
import { createFileSystemProject } from "bun-workspaces";

const project = createFileSystemProject();

// Run in parallel with the default limit.
// Equal to "auto" or value of 
// the root ${ENV_VARS_METADATA.parallelMaxDefault.rootConfigDefaultsKey} 
// or process.env.${ENV_VARS_METADATA.parallelMaxDefault.envVarName}
project.runScriptAcrossWorkspaces({
  script: "my-script"
});

// Same result as above
project.runScriptAcrossWorkspaces({
  script: "my-script",
  parallel: { max: "default" },
});

// Run sequentially by disabling parallel
project.runScriptAcrossWorkspaces({
  script: "my-script",
  parallel: false,
});

// Run in parallel with the number of available logical CPUs
project.runScriptAcrossWorkspaces({
  script: "my-script",
  parallel: { max: "auto" },
});

// Run in parallel with a max of 2 concurrent scripts
project.runScriptAcrossWorkspaces({
  script: "my-script",
  parallel: { max: 2 },
});

// Run in parallel with a max of 50% of the available logical CPUs
project.runScriptAcrossWorkspaces({
  script: "my-script",
  parallel: { max: "50%" },
});

// Run in parallel with no concurrency limit (use with caution)
project.runScriptAcrossWorkspaces({
  script: "my-script",
  parallel: { max: "unbounded" },
});
`.trim();

export const API_INLINE_SHELL_EXAMPLE = `
import { createFileSystemProject } from "bun-workspaces";

const project = createFileSystemProject();

// This will use the Bun shell, 
// unless the root${ENV_VARS_METADATA.scriptShellDefault.rootConfigDefaultsKey}
// or process.env.${ENV_VARS_METADATA.scriptShellDefault.envVarName} is set to "system"
project.runWorkspaceScript({
  workspaceNameOrAlias: "my-workspace",
  script: "echo 'this is my inline script'",
  inline: true,
});

project.runWorkspaceScript({
  workspaceNameOrAlias: "my-workspace",
  script: "echo 'this is my inline script'",
  // Takes "bun", "system", or "default", same as the CLI --shell option
  inline: { shell: "system" },
});
`.trim();

export const API_ROOT_SELECTOR_EXAMPLE = `
import { createFileSystemProject } from "bun-workspaces";

const project = createFileSystemProject();

// A way to directly get the root workspace object (always available)
const rootWorkspace = project.rootWorkspace;

// Match the root workspace by the special selector (always available)
project.runScriptAcrossWorkspaces({
  workspacePatterns: ["@root"],
  script: "lint",
});
`.trim();

export const API_DETERMINE_AFFECTED_GIT_EXAMPLE = `
// Workspace results contain details about each workspace,
// including whether it is affected and why
const { workspaceResults } = await project.determineAffectedWorkspaces({
  // Optional, the script to run to determine affected workspaces
  // When not provided, based on workspaces' default inputs
  script: "my-script",
  diffSource: "git",
  diffOptions: {
    // Optional, defaults to main if default base ref not configured
    baseRef: "my-branch-a",
    // Optional, defaults to current HEAD if not provided
    headRef: "my-branch-b",

    // Optional means of ignoring uncommitted changes
    // gitignored files are never included in a diff
    ignoreUntracked: false, // files that may be tracked but aren't
    ignoreStaged: false,
    ignoreUnstaged: false,
    // Ignores untracked, staged, and unstaged
    ignoreUncommitted: false,
  },
  // Ignore workspace dependencies when determining affected workspaces
  ignoreWorkspaceDependencies: false,
  // Ignore changes external dependencies (e.g. react, lodash) lock versions
  ignoreExternalDependencies: false,
});
`.trim();

export const API_DETERMINE_AFFECTED_FILE_LIST_EXAMPLE = `
const { workspaceResults } = await project.determineAffectedWorkspaces({
  // Bypass git and pass a list of changed files instead that match workspace inputs
  diffSource: "fileList",
  changedFiles: ["src/**/*.ts", "something.txt"],
});
`.trim();

export const API_DETERMINE_AFFECTED_OPTIONS_EXAMPLE = `
// Returns the same output and summary as project.runScriptAcrossWorkspaces
const { output, summary } = await project.runAffectedWorkspaceScript({
  // About the same options as project.determineAffectedWorkspaces
  affectedOptions: {
    diffSource: "git",
    diffOptions: {
      baseRef: "my-branch-a",
      headRef: "my-branch-b",
    },
  },
  // About the same options as project.runScriptAcrossWorkspaces
  scriptOptions: {
    script: "my-script",
  },
});
`.trim();
