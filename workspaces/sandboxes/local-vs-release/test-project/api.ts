import { createFileSystemProject } from "pacwich";
import { createMemoryProject } from "pacwich_local";

// A Project contains the core functionality of Pacwich.
// Below defaults to process.cwd() for the project root directory
// Pass { rootDirectory: "path/to/your/project" } to use a different root directory
const project = createFileSystemProject({
  rootDirectory: ".",
  includeRootWorkspace: false,
});

// A Workspace that matches the name or alias "my-workspace"
const workspaceA = project.findWorkspaceByNameOrAlias("workspace-a");

console.log({ workspaceA });

const workspaceB = project.findWorkspaceByNameOrAlias("wb");

console.log({ workspaceB });

// Array of workspaces whose names match the wildcard pattern
const wildcardWorkspaces = project.findWorkspacesByPattern("workspace-*");

console.log({ wildcardWorkspaces });

// Array of workspaces that have "my-script" in their package.json "scripts"
const workspacesWithScript =
  project.listWorkspacesWithScript("workspace-script");

console.log({ workspacesWithScript });

// Run a script in a workspace
const runSingleScript = async () => {
  const { output, exit } = project.runWorkspaceScript({
    workspaceNameOrAlias: "wb",
    script: "workspace-script",
    args: "--my --appended --args", // optional, arguments to add to the command

    // Optional. Whether to ignore all output from the script.
    // This saves memory when you don't need script output.
    ignoreOutput: false,
  });

  // Get a stream of the script subprocess's output
  for await (const { chunk, metadata } of output.text()) {
    console.log(metadata.streamName, metadata.workspace.name); // The output stream, "stdout" or "stderr"
    console.log(chunk); // The output chunk's content (string)
  }

  // Get data about the script execution after it exits
  const exitResult = await exit;

  console.log({ exitResult });
};

// console.log("Running single script...");
// await runSingleScript();

// Run a script in all workspaces that have it in their package.json "scripts" field
const runManyScripts = async () => {
  const { output, summary } = project.runScriptAcrossWorkspaces({
    // Optional. This will run in all matching workspaces that have my-script
    // Accepts same values as the CLI run-script command's workspace patterns
    // When not provided, all workspaces that have the script will be used.
    // workspacePatterns: [],

    // Required. The package.json "scripts" field name to run
    script: "workspace-script",

    // Optional. Arguments to add to the command
    args: "--my --appended --args",

    // Optional. Whether to run the scripts in parallel (default: true)
    parallel: true,

    // Optional. When true, a workspace's script will wait
    // until any workspaces it depends on have completed
    dependencyOrder: true,

    // Optional. When true and dependencyOrder is true,
    // continue running scripts even if a dependency fails
    ignoreDependencyFailure: false,

    // Optional. Whether to ignore all output from the scripts.
    // This saves memory when you don't need script output.
    ignoreOutput: true,

    // Optional, callback when script starts, skips, or exits
    onScriptEvent: (event, { workspace, exitResult }) => {
      // event: "start", "skip", "exit"
      console.log(event, workspace.name, exitResult?.exitCode);
    },
  });

  // Get a stream of script output
  for await (const { chunk, metadata } of output.text()) {
    console.log(metadata.streamName, metadata.workspace.name);
    console.log(chunk);
  }

  // Get final summary data and script exit details after all scripts have completed
  const summaryResult = await summary;

  console.log(JSON.stringify({ summaryResult }, null, 2));
};

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
      tags: [],
      dependencies: [],
      dependents: [],
      externalDependencies: [],
    },
  ],
});
