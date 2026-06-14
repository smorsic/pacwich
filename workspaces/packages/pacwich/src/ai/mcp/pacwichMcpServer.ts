import { ENTRY_SLICE, renderMcpResourceList } from "@pacwich/common/docs";
import { PACWICH_VERSION } from "@pacwich/common/version";
import { createMcpServer } from "./core";
import { registerPacwichResources } from "./resources";
import { registerPacwichTools } from "./tools";

export const SERVER_INSTRUCTIONS = `
pacwich ${PACWICH_VERSION} MCP server: documentation resources for the pacwich npm package.

pacwich is a CLI and TS API for monorepo tooling on top of Bun, npm, or pnpm workspaces.

Files such as pacwich.workspace.ts and pacwich.project.ts may be present for configuration.

Use resources for docs on the CLI and TS API (start with ${ENTRY_SLICE.mcpUri}):
${renderMcpResourceList()}

## CLI quickstart
\`\`\`bash
$ alias pacwich="bunx pacwich"
$ pacwich --help # usage
$ # run is an alias for run-script
$ pacwich run lint # run the "lint" script for all workspaces that have it
$ pacwich run "echo inline script" --inline # run an inline command via the Bun shell
$ pacwich run lint my-workspace-a my-workspace-b # run for specific workspaces
$ pacwich run lint --dep-order # run the lint script for all workspaces, waiting for all dependencies to complete
$ pacwich run lint "my-workspace-*" # wildcard for workspace names
$ pacwich run lint "alias:my-alias-*" "path:packages/**/*" "not:path:my-path/*" # use workspace patterns
\`\`\`
<!-- end pacwich MCP instructions -->
`.trim();

export const startPacwichMcpServer = async (): Promise<void> => {
  const server = createMcpServer({
    name: "pacwich",
    version: PACWICH_VERSION,
    instructions: SERVER_INSTRUCTIONS,
  });

  registerPacwichTools(server);
  registerPacwichResources(server);

  await server.start();
};
