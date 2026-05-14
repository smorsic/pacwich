import packageJson from "../../../package.json";
import { createMcpServer } from "./core";
import { registerBwResources } from "./resources";
import {
  setServerEnableExecutableConfigs,
  setServerWorkingDirectory,
} from "./serverState";
import { registerBwTools } from "./tools";

export const SERVER_INSTRUCTIONS = `
bun-workspaces ${packageJson.version} MCP server: tools to query Bun monorepo workspace metadata and documentation resources for the bun-workspaces CLI and TypeScript API.

bun-workspaces is an npm package that works on top of Bun's native workspaces. It has a CLI and TS API.

Files such as bw.workspace.ts and bw.root.ts may be present for configuration.

Use resources for docs on the CLI and TS API, or get a project overview via bw://project.
bw://docs/overview, bw://docs/concepts, bw://docs/cli, bw://docs/api, and bw://docs/config cover most functionality.

Use the tools to get specific metadata about the project.

## CLI quickstart
\`\`\`bash
$ alias bw="bunx bun-workspaces"
$ bw --help # usage
$ # run is an alias for run-script
$ bw run lint # run the "lint" script for all workspaces that have it
$ bw run "echo inline script" --inline # run an inline command via the Bun shell
$ bw run lint my-workspace-a my-workspace-b # run for specific workspaces
$ bw run lint --dep-order # run the lint script for all workspaces, waiting for all dependencies to complete
$ bw run lint "my-workspace-*" # wildcard for workspace names
$ bw run lint "alias:my-alias-*" "path:packages/**/*" "not:path:my-path/*" # use workspace patterns
\`\`\`

(end bun-workspaces MCP instructions)
`.trim();

export interface BwMcpServerOptions {
  initialWorkingDirectory: string;
  /**
   * When true, allow `bw.root.{ts,js}` and `bw.workspace.{ts,js}` to be
   * evaluated for every project the server resolves. Defaults to false
   * because the server can be redirected to arbitrary directories at
   * runtime via the `set_working_directory` tool, which would otherwise
   * make config loading a remote-code-execution channel.
   */
  enableExecutableConfigs?: boolean;
}

export const startBwMcpServer = async (
  options: BwMcpServerOptions,
): Promise<void> => {
  setServerEnableExecutableConfigs(options.enableExecutableConfigs ?? false);
  setServerWorkingDirectory(options.initialWorkingDirectory);

  const server = createMcpServer({
    name: "bun-workspaces",
    version: packageJson.version,
    instructions: SERVER_INSTRUCTIONS,
  });

  registerBwTools(server);
  registerBwResources(server);

  await server.start();
};
