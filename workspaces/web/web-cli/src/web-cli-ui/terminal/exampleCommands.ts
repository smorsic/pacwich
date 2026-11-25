/**
 * Example commands shown in the terminal's "Examples" dropdown, matching
 * what this workspace's demo project (`src/demo-project/`) actually
 * supports: apps/my-app-a, apps/my-app-b, and libraries/*, tagged
 * frontend/backend/shared/library/app/app-a/app-b/app-share with aliases.
 */

export type ExampleCommand = {
  name: string;
  description: string;
  command: string;
};

export const EXAMPLE_COMMANDS = [
  {
    name: "List Workspaces",
    description: "List all workspaces",
    command: "list-workspaces",
  },
  {
    name: "List Workspaces - JSON",
    description:
      "List all workspaces as JSON - Metadata commands like this generally take these same options",
    command: "ls --json --pretty",
  },
  {
    name: "List Scripts",
    description: "List all scripts available with their workspaces",
    command: "list-scripts",
  },
  {
    name: "Workspace Info",
    description: "Show metadata about a workspace, by its alias",
    command: "info shr-b",
  },
  {
    name: "List Tags",
    description: "List all tags defined across workspaces",
    command: "list-tags",
  },
  {
    name: "Tag Info",
    description: "Show the workspaces carrying a given tag",
    command: "tag-info frontend",
  },
  {
    name: "List Affected Workspaces",
    description: "List all workspaces affected by changes",
    command: "affected list --files='libraries/shared-utils/**/*.ts'",
  },
  {
    name: "Explain Affected Workspaces",
    description: "List all workspaces affected by changes",
    command: "affected list --files='libraries/shared-utils/**/*.ts' --explain",
  },
  {
    name: "Run Script - build all workspaces",
    description: "Run the build script for all workspaces in parallel",
    command: "run build",
  },
  {
    name: "Run Script - build specific workspaces",
    description: "Run the build script for specific workspaces",
    command: "run build @demo/backend-a @demo/backend-b",
  },
  {
    name: "Run Script - build by wildcard",
    description:
      "Run the build script for workspaces' names matching the wildcard",
    command: 'run build "@demo/frontend-*"',
  },
  {
    name: "Run Script - build by path",
    description: "Run the build script for workspaces' paths matching the glob",
    command: 'run build "path:apps/**/*"',
  },
  {
    name: "Run Script - build by tag",
    description: "Run the build script for workspaces carrying a given tag",
    command: 'run build "tag:frontend"',
  },
  {
    name: "Run Script - Run builds sequentially",
    description: "Run the build script in series (one after the other)",
    command: "run build --parallel=false",
  },
  {
    name: "Run Script - Run with a parallel max of 2",
    description: "Only two scripts can run at the same time",
    command: "run build --parallel=2",
  },
  {
    name: "Run Script - Prefixed output style",
    description: "Script output uses plain lines with workspace prefixes",
    command: "run build --output-style=prefixed",
  },
  {
    name: "Run Script - run builds in dependency order",
    description:
      "The workspaces that depend on shared-utils will wait until its script is complete",
    command: "run build --dep-order",
  },
  {
    name: "Run Script - Named options instead of positional args",
    description: "Named options can be used instead of positional args",
    command: 'run --workspace-patterns="alias:be-a alias:be-b" --script=build',
  },
  {
    name: "Run Script - Run Affected Workspaces",
    description: "Run a script for all workspaces affected by changes",
    command: "affected run build --files='libraries/backend-utils/**/*.ts'",
  },
  {
    name: "Include the Root workspace",
    description:
      "The -r or --include-root global option includes the root package as a normal workspace in any command used",
    command: "ls --include-root",
  },
  {
    name: "Usage",
    description: "Show CLI usage",
    command: "--help",
  },
  {
    name: "Command Usage",
    description: "Show usage for a specific command",
    command: "help run",
  },
  {
    name: "Version",
    description: "Show the pacwich version",
    command: "--version",
  },
  {
    name: "Doctor",
    description:
      "Print diagnostic info about the environment (some values are dummy data here, since there's no real host machine)",
    command: "doctor",
  },
  {
    name: "Verify",
    description:
      "Scan for implicit workspace dependencies not declared in package.json",
    command: "verify",
  },
] satisfies ExampleCommand[];
