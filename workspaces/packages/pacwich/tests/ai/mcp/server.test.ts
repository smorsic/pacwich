import { createMcpServer } from "../../../src/ai/mcp/core/server";
import { createMemoryTransport } from "../../../src/ai/mcp/core/transport";
import {
  JSON_RPC_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
} from "../../../src/ai/mcp/core/types";
import { describe, expect, test } from "../../util/testFramework";

const runServer = async (
  messages: Record<string, unknown>[],
  setup?: (server: ReturnType<typeof createMcpServer>) => void,
) => {
  const transport = createMemoryTransport(messages);
  const server = createMcpServer({
    name: "test-server",
    version: "1.0.0",
    instructions: "Test server",
  });
  setup?.(server);
  await server.start(transport);
  return transport.sent;
};

describe("MCP core server", () => {
  describe("initialize", () => {
    test("returns protocol version, server info, and instructions", async () => {
      const [response] = await runServer([
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      ]);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          serverInfo: { name: "test-server", version: "1.0.0" },
          instructions: "Test server",
        },
      });
    });

    test("reports tools capability when tools are registered", async () => {
      const [response] = await runServer(
        [{ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }],
        (server) => {
          server.registerTool(
            {
              name: "my_tool",
              description: "A tool",
              inputSchema: { type: "object" },
            },
            () => ({ content: [{ type: "text", text: "ok" }] }),
          );
        },
      );
      expect((response.result as Record<string, unknown>).capabilities).toEqual(
        { tools: {} },
      );
    });

    test("reports resources capability when resources are registered", async () => {
      const [response] = await runServer(
        [{ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }],
        (server) => {
          server.registerResource(
            { uri: "test://res", name: "A resource" },
            (uri) => ({
              contents: [{ uri, mimeType: "text/plain", text: "hello" }],
            }),
          );
        },
      );
      expect((response.result as Record<string, unknown>).capabilities).toEqual(
        { resources: {} },
      );
    });

    test("omits instructions when not provided", async () => {
      const transport = createMemoryTransport([
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      ]);
      const server = createMcpServer({ name: "s", version: "0.0.1" });
      await server.start(transport);
      const [response] = transport.sent;
      expect(
        (response.result as Record<string, unknown>).instructions,
      ).toBeUndefined();
    });
  });

  describe("ping", () => {
    test("returns empty result", async () => {
      const [response] = await runServer([
        { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
      ]);
      expect(response).toEqual({ jsonrpc: "2.0", id: 2, result: {} });
    });
  });

  describe("notifications", () => {
    test("notifications (no id) produce no response", async () => {
      const sent = await runServer([
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
      ]);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    });
  });

  describe("tools/list", () => {
    test("returns empty list when no tools registered", async () => {
      const [response] = await runServer([
        { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
      ]);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 3,
        result: { tools: [] },
      });
    });

    test("returns registered tools", async () => {
      const tool = {
        name: "my_tool",
        description: "Does something",
        inputSchema: {
          type: "object" as const,
          properties: { x: { type: "string" as const } },
        },
      };
      const [response] = await runServer(
        [{ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }],
        (server) =>
          server.registerTool(tool, () => ({
            content: [{ type: "text", text: "ok" }],
          })),
      );
      expect((response.result as Record<string, unknown>).tools).toEqual([
        tool,
      ]);
    });
  });

  describe("tools/call", () => {
    test("calls tool handler and returns result", async () => {
      const [response] = await runServer(
        [
          {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: { name: "my_tool", arguments: { x: "hello" } },
          },
        ],
        (server) =>
          server.registerTool(
            {
              name: "my_tool",
              description: "A tool",
              inputSchema: { type: "object" },
            },
            ({ x }) => ({ content: [{ type: "text", text: `got: ${x}` }] }),
          ),
      );
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 4,
        result: { content: [{ type: "text", text: "got: hello" }] },
      });
    });

    test("returns error for unknown tool", async () => {
      const [response] = await runServer([
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "missing", arguments: {} },
        },
      ]);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 5,
        error: {
          code: JSON_RPC_ERROR_CODES.methodNotFound,
          message: "Tool not found: missing",
        },
      });
    });

    test("returns isError result when handler throws", async () => {
      const [response] = await runServer(
        [
          {
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: { name: "bad_tool", arguments: {} },
          },
        ],
        (server) =>
          server.registerTool(
            {
              name: "bad_tool",
              description: "Throws",
              inputSchema: { type: "object" },
            },
            () => {
              throw new Error("something went wrong");
            },
          ),
      );
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 6,
        result: {
          content: [{ type: "text", text: "something went wrong" }],
          isError: true,
        },
      });
    });
  });

  describe("resources/list", () => {
    test("returns empty list when no resources registered", async () => {
      const [response] = await runServer([
        { jsonrpc: "2.0", id: 7, method: "resources/list", params: {} },
      ]);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 7,
        result: { resources: [] },
      });
    });

    test("returns registered resources", async () => {
      const resource = {
        uri: "test://doc",
        name: "A doc",
        description: "Desc",
        mimeType: "text/plain",
      };
      const [response] = await runServer(
        [{ jsonrpc: "2.0", id: 7, method: "resources/list", params: {} }],
        (server) =>
          server.registerResource(resource, (uri) => ({
            contents: [{ uri, mimeType: "text/plain", text: "content" }],
          })),
      );
      expect((response.result as Record<string, unknown>).resources).toEqual([
        resource,
      ]);
    });
  });

  describe("resources/read", () => {
    test("reads a registered resource", async () => {
      const [response] = await runServer(
        [
          {
            jsonrpc: "2.0",
            id: 8,
            method: "resources/read",
            params: { uri: "test://doc" },
          },
        ],
        (server) =>
          server.registerResource(
            { uri: "test://doc", name: "A doc" },
            (uri) => ({
              contents: [{ uri, mimeType: "text/plain", text: "the content" }],
            }),
          ),
      );
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 8,
        result: {
          contents: [
            { uri: "test://doc", mimeType: "text/plain", text: "the content" },
          ],
        },
      });
    });

    test("returns error for unknown resource", async () => {
      const [response] = await runServer([
        {
          jsonrpc: "2.0",
          id: 9,
          method: "resources/read",
          params: { uri: "test://missing" },
        },
      ]);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 9,
        error: {
          code: JSON_RPC_ERROR_CODES.invalidParams,
          message: "Resource not found: test://missing",
        },
      });
    });
  });

  describe("unknown method", () => {
    test("returns method not found error", async () => {
      const [response] = await runServer([
        { jsonrpc: "2.0", id: 10, method: "unknown/method", params: {} },
      ]);
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 10,
        error: {
          code: JSON_RPC_ERROR_CODES.methodNotFound,
          message: "Method not found: unknown/method",
        },
      });
    });
  });

  describe("multiple messages", () => {
    test("processes all messages in sequence", async () => {
      const sent = await runServer([
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
        { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
      ]);
      expect(sent).toHaveLength(3);
      expect(sent[0].id).toBe(1);
      expect(sent[1].id).toBe(2);
      expect(sent[2].id).toBe(3);
    });
  });
});
