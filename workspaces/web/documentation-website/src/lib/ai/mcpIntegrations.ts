/** Server entry for GUI apps that don't inherit shell PATH (Cursor, Claude Desktop) */
export const MCP_CONFIG = {
  mcpServers: {
    pacwich: {
      command: "npx",
      args: ["pacwich", "mcp-server"],
    },
  },
};

/** .cursor/mcp.json (project-local) or ~/.cursor/mcp.json (global) */
export const CURSOR_MCP_CONFIG_PATH = ".cursor/mcp.json";

/** Project-local .mcp.json at the repo root */
export const CLAUDE_CODE_MCP_CONFIG_PATH = ".mcp.json";
