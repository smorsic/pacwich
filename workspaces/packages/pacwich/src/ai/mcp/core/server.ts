import { createStdioTransport, type McpTransport } from "./transport";
import {
  JSON_RPC_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  type CallToolResult,
  type InitializeResult,
  type JsonRpcId,
  type McpServerInfo,
  type ReadResourceResult,
  type Resource,
  type ResourceHandler,
  type Tool,
  type ToolHandler,
} from "./types";

type RegisteredTool = { tool: Tool; handler: ToolHandler };
type RegisteredResource = { resource: Resource; handler: ResourceHandler };

export type McpServer = {
  registerTool: (tool: Tool, handler: ToolHandler) => void;
  registerResource: (resource: Resource, handler: ResourceHandler) => void;
  start: (transport?: McpTransport) => Promise<void>;
};

export const createMcpServer = (info: McpServerInfo): McpServer => {
  const tools = new Map<string, RegisteredTool>();
  const resources = new Map<string, RegisteredResource>();

  const registerTool = (tool: Tool, handler: ToolHandler): void => {
    tools.set(tool.name, { tool, handler });
  };

  const registerResource = (
    resource: Resource,
    handler: ResourceHandler,
  ): void => {
    resources.set(resource.uri, { resource, handler });
  };

  const start = async (transport?: McpTransport): Promise<void> => {
    const activeTransport = transport ?? createStdioTransport();

    const send = (id: JsonRpcId, result: unknown): void => {
      activeTransport.send({ jsonrpc: "2.0", id, result });
    };

    const sendError = (id: JsonRpcId, code: number, message: string): void => {
      activeTransport.send({ jsonrpc: "2.0", id, error: { code, message } });
    };

    const handleInitialize = (id: JsonRpcId): void => {
      const result: InitializeResult = {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          ...(tools.size > 0 ? { tools: {} as Record<string, never> } : {}),
          ...(resources.size > 0
            ? { resources: {} as Record<string, never> }
            : {}),
        },
        serverInfo: { name: info.name, version: info.version },
        ...(info.instructions !== undefined
          ? { instructions: info.instructions }
          : {}),
      };
      send(id, result);
    };

    const handleListTools = (id: JsonRpcId): void => {
      send(id, { tools: [...tools.values()].map(({ tool }) => tool) });
    };

    const handleCallTool = async (
      id: JsonRpcId,
      params: Record<string, unknown>,
    ): Promise<void> => {
      const name = params["name"] as string;
      const args = (params["arguments"] ?? {}) as Record<string, unknown>;
      const registered = tools.get(name);

      if (!registered) {
        sendError(
          id,
          JSON_RPC_ERROR_CODES.methodNotFound,
          `Tool not found: ${name}`,
        );
        return;
      }

      try {
        const result: CallToolResult = await registered.handler(args);
        send(id, result);
      } catch (error) {
        send(id, {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        });
      }
    };

    const handleListResources = (id: JsonRpcId): void => {
      send(id, {
        resources: [...resources.values()].map(({ resource }) => resource),
      });
    };

    const handleReadResource = async (
      id: JsonRpcId,
      params: Record<string, unknown>,
    ): Promise<void> => {
      const uri = params["uri"] as string;
      const registered = resources.get(uri);

      if (!registered) {
        sendError(
          id,
          JSON_RPC_ERROR_CODES.invalidParams,
          `Resource not found: ${uri}`,
        );
        return;
      }

      try {
        const result: ReadResourceResult = await registered.handler(uri);
        send(id, result);
      } catch (error) {
        sendError(
          id,
          JSON_RPC_ERROR_CODES.internalError,
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    for await (const raw of activeTransport.receive()) {
      const method = raw["method"];
      if (typeof method !== "string") continue;

      const id = raw["id"];
      // Notifications have no id, so no response needed
      if (id === undefined || id === null) continue;

      const requestId = id as JsonRpcId;
      const params = (raw["params"] ?? {}) as Record<string, unknown>;

      switch (method) {
        case "initialize":
          handleInitialize(requestId);
          break;
        case "ping":
          send(requestId, {});
          break;
        case "tools/list":
          handleListTools(requestId);
          break;
        case "tools/call":
          await handleCallTool(requestId, params);
          break;
        case "resources/list":
          handleListResources(requestId);
          break;
        case "resources/read":
          await handleReadResource(requestId, params);
          break;
        default:
          sendError(
            requestId,
            JSON_RPC_ERROR_CODES.methodNotFound,
            `Method not found: ${method}`,
          );
      }
    }
  };

  return { registerTool, registerResource, start };
};
