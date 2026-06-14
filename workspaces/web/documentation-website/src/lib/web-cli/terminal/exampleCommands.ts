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
    description: "Show metadata about a workspace",
    command: "info frontend",
  },
  {
    name: "Workspace Info - By alias",
    description: "Show metadata about a workspace by referencing its alias",
    command: "info fe",
  },
  {
    name: "List Tags",
    description: "List all tags available with their workspaces",
    command: "list-tags",
  },
  {
    name: "Tag Info",
    description: "Show metadata about a tag",
    command: "tag-info application",
  },
  {
    name: "List Affected Workspaces",
    description: "List all workspaces affected by changes",
    command: "list-affected --files='packages/shared/**/*.ts'",
  },
  {
    name: "Explain Affected Workspaces",
    description: "List all workspaces affected by changes",
    command: "list-affected --files='packages/shared/**/*.ts' --explain",
  },
  {
    name: "Run Script - type-check all workspaces",
    description: "Run the type-check script for all workspaces in parallel",
    command: "run type-check",
  },
  {
    name: "Run Script - type-check specific workspaces",
    description: "Run the type-check script for specific workspaces",
    command: "run type-check frontend backend",
  },
  {
    name: "Run Script - type-check by wildcard",
    description:
      "Run the type-check script for workspaces' names matching the wildcard",
    command: 'run type-check "*end"',
  },
  {
    name: "Run Script - type-check by path",
    description:
      "Run the type-check script for workspaces' paths matching the glob",
    command: 'run type-check "path:packages/**/*"',
  },
  {
    name: "Run Script - type-check workspaces by aliases",
    description:
      "Run the type-check script for specific workspaces using aliases",
    command: "run type-check fe be",
  },
  {
    name: "Run Script - build workspaces by tag",
    description:
      "Run the build script for workspaces with the 'application' tag",
    command: 'run build "tag:application"',
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
      'The workspaces that depend on the "shared" workspace will wait until "shared"\'s script is complete',
    command: "run build --dep-order",
  },
  {
    name: "Run Script - Named options instead of positional args",
    description: "Named options can be used instead of positional args",
    command: 'run --workspace-patterns="frontend backend" --script=build',
  },
  {
    name: "Run Script - Run Affected Workspaces",
    description: "Run a script for all workspaces affected by changes",
    command: "run-affected build --files='packages/frontend/**/*.{ts,tsx}'",
  },
  {
    name: "Include the Root workspace",
    description:
      "The -r or --include-root global option includes the root package as a normal workspace in any command used",
    command: "ls --include-root",
  },
  {
    name: "Run Root script",
    description:
      "It's possible to reference the root package, despite it normally not being treated as a normal workspace",
    command: "run build-all @root -o plain",
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
] satisfies ExampleCommand[];
