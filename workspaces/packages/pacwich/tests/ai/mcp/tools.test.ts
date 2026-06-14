import { DOC_SLICES } from "@pacwich/common/docs";
import { PACWICH_VERSION } from "@pacwich/common/version";
import { createMcpServer } from "../../../src/ai/mcp/core/server";
import { createMemoryTransport } from "../../../src/ai/mcp/core/transport";
import { registerPacwichTools } from "../../../src/ai/mcp/tools";
import { describe, expect, test } from "../../util/testFramework";

const callTool = async (
  toolName: string,
  args: Record<string, unknown> = {},
) => {
  const transport = createMemoryTransport([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    },
  ]);
  const server = createMcpServer({ name: "pacwich", version: "0.0.0" });
  registerPacwichTools(server);
  await server.start(transport);
  const response = transport.sent[0] as {
    result?: { content: { text: string }[]; isError?: boolean };
  };
  const text = response.result?.content[0]?.text ?? "";
  let result: unknown = null;
  try {
    result = JSON.parse(text);
  } catch {
    result = text;
  }
  return { result, isError: response.result?.isError };
};

describe("pacwich MCP tools", () => {
  describe("version", () => {
    test("returns the version of pacwich", async () => {
      const { result, isError } = await callTool("version");
      expect(isError).toBeUndefined();
      expect(result).toBeObject();
      expect((result as { version: string }).version).toBe(PACWICH_VERSION);
    });
  });

  describe("list_ai_integrations", () => {
    test("returns sections for every integration channel", async () => {
      const { result, isError } = await callTool("list_ai_integrations");
      expect(isError).toBeUndefined();
      expect(result).toBeObject();
      const data = result as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual([
        "agents_md",
        "llms_txt",
        "mcp_resources",
        "skills",
      ]);
    });

    test("mcp_resources slices match DOC_SLICES", async () => {
      const { result } = await callTool("list_ai_integrations");
      const mcp = (result as { mcp_resources: { slices: { uri: string }[] } })
        .mcp_resources;
      expect(mcp.slices.map((s) => s.uri)).toEqual(
        DOC_SLICES.map((slice) => slice.mcpUri),
      );
    });

    test("agents_md and skills lists are derived from DOC_SLICES", async () => {
      const { result } = await callTool("list_ai_integrations");
      const data = result as {
        agents_md: { split_files: string[] };
        skills: { skill_names: string[] };
      };
      expect(data.agents_md.split_files).toEqual(
        DOC_SLICES.map((slice) => slice.agentsFileName),
      );
      expect(data.skills.skill_names).toEqual(
        DOC_SLICES.map((slice) => slice.skillName),
      );
    });
  });
});
