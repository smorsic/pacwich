export const RUN_WORKSPACE_SCRIPT_EXAMPLE = `
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

`.trim();

export const RUN_SCRIPT_ACROSS_WORKSPACES_EXAMPLE = `

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
`.trim();

export const API_QUICKSTART = `
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
  ${RUN_WORKSPACE_SCRIPT_EXAMPLE.split("\n")
    .join("\n  ")
    .replace(/\n {2}\n/g, "\n\n")}
};

// Run a script in all workspaces that have it in their package.json "scripts"
const runManyScripts = async () => {
  ${RUN_SCRIPT_ACROSS_WORKSPACES_EXAMPLE.split("\n")
    .join("\n  ")
    .replace(/\n {2}\n/g, "\n\n")}
};
`.trim();
