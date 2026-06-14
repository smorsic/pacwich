export type JsonRpcId = string | number;

export type JsonRpcSuccessResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

export type JsonRpcErrorResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export const JSON_RPC_ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export type ServerCapabilities = {
  tools?: Record<string, never>;
  resources?: Record<string, never>;
};

export type McpServerInfo = {
  name: string;
  version: string;
  instructions?: string;
};

export type InitializeResult = {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: { name: string; version: string };
  instructions?: string;
};

export type JsonSchemaProperty =
  | { type: "string"; description?: string; enum?: string[] }
  | { type: "number"; description?: string }
  | { type: "boolean"; description?: string }
  | {
      type: "array";
      items: JsonSchemaProperty;
      description?: string;
    }
  | {
      type: "object";
      properties?: Record<string, JsonSchemaProperty>;
      required?: string[];
      description?: string;
    };

export type ToolInputSchema = {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
};

export type TextContent = {
  type: "text";
  text: string;
};

export type CallToolResult = {
  content: TextContent[];
  isError?: boolean;
};

export type Resource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type ResourceContent = {
  uri: string;
  mimeType: string;
  text: string;
};

export type ReadResourceResult = {
  contents: ResourceContent[];
};

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<CallToolResult> | CallToolResult;

export type ResourceHandler = (
  uri: string,
) => Promise<ReadResourceResult> | ReadResourceResult;
