import { DOC_SLICES } from "@pacwich/common/docs";
import { PACWICH_VERSION } from "@pacwich/common/version";
import type { McpServer, CallToolResult } from "./core";

const textResult = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorResult = (message: string): CallToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const buildAiIntegrations = () => ({
  mcp_resources: {
    summary:
      "Documentation slices served as MCP resources by this server. Read them via your client's resource interface.",
    combined: {
      uri: "pacwich://docs/all",
      description: "All pacwich documentation in one resource.",
    },
    slices: DOC_SLICES.map((slice) => ({
      uri: slice.mcpUri,
      name: slice.mcpName,
      description: slice.description,
    })),
  },
  agents_md: {
    summary:
      "Markdown files bundled with the installed pacwich package for ambient AI context. Same content as the MCP resources.",
    combined_path: "node_modules/pacwich/AGENTS.md",
    split_dir: "node_modules/pacwich/agents/",
    split_files: DOC_SLICES.map((slice) => slice.agentsFileName),
    web_urls: {
      combined: "https://pacwich.dev/AGENTS.md",
      split: DOC_SLICES.map(
        (slice) => `https://pacwich.dev/agents/${slice.agentsFileName}`,
      ),
    },
    docs: "https://pacwich.dev/ai/agents",
  },
  skills: {
    summary:
      "Claude Code skill files you install into your repo via the CLI. Same content as the MCP resources, invoked on demand rather than ambient.",
    cli: "pacwich add-skills --dir=.claude/skills",
    skill_names: DOC_SLICES.map((slice) => slice.skillName),
    docs: "https://pacwich.dev/ai/skills",
  },
  llms_txt: {
    summary:
      "Experimental docs manifest served from the documentation site, generated from the full website docs.",
    url: "https://pacwich.dev/llms.txt",
    docs: "https://pacwich.dev/ai/llms-txt",
  },
});

export const registerPacwichTools = (server: McpServer): void => {
  server.registerTool(
    {
      name: "version",
      description: "Get the version of pacwich used by this MCP server",
      inputSchema: { type: "object" },
    },
    () => textResult({ version: PACWICH_VERSION }),
  );

  server.registerTool(
    {
      name: "list_ai_integrations",
      description:
        "List all AI integrations pacwich provides: MCP resources served by this server, AGENTS.md files bundled with the package, skill files installed via the CLI, and the llms.txt manifest served by the docs site.",
      inputSchema: { type: "object" },
    },
    () => textResult(buildAiIntegrations()),
  );
};
