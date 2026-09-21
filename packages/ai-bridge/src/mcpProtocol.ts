import type { McpCallResult, McpTool, McpToolContext } from './contracts';

type JsonRpcId = string | number;

export type McpRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type McpResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code: number; message: string };
};

type McpRegistry = {
  listTools(): McpTool[];
  callTool(
    name: string,
    args: Record<string, unknown>,
    context: McpToolContext,
  ): Promise<McpCallResult>;
};

/**
 * Transport-neutral MCP JSON-RPC boundary. Authentication, session creation,
 * approval UI, and rate limiting remain in the embedding transport/host.
 */
export function createMcpRequestHandler(
  registry: McpRegistry,
  getContext: () => McpToolContext,
) {
  return async (request: unknown): Promise<McpResponse | null> => {
    const parsed = parseRequest(request);
    if (!parsed) {
      return errorResponse(null, -32600, 'Invalid JSON-RPC request.');
    }
    if (parsed.id == null && parsed.method.startsWith('notifications/')) {
      return null;
    }
    if (parsed.id == null) {
      return errorResponse(null, -32600, 'A request id is required.');
    }

    switch (parsed.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: parsed.id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: 'actuali-mcp', version: '0.1.0' },
          },
        };
      case 'tools/list':
        if (parsed.params && Object.keys(parsed.params).length > 0) {
          return errorResponse(
            parsed.id,
            -32602,
            'tools/list accepts no parameters.',
          );
        }
        return {
          jsonrpc: '2.0',
          id: parsed.id,
          result: { tools: registry.listTools() },
        };
      case 'tools/call': {
        if (!parsed.params || !isRecord(parsed.params)) {
          return errorResponse(
            parsed.id,
            -32602,
            'tools/call parameters are required.',
          );
        }
        const name =
          typeof parsed.params.name === 'string' ? parsed.params.name : '';
        const args = parsed.params.arguments;
        if (!name || !isRecord(args)) {
          return errorResponse(
            parsed.id,
            -32602,
            'Tool name and object arguments are required.',
          );
        }
        return {
          jsonrpc: '2.0',
          id: parsed.id,
          result: await registry.callTool(name, args, getContext()),
        };
      }
      default:
        return errorResponse(
          parsed.id,
          -32601,
          `Method not found: ${parsed.method}`,
        );
    }
  };
}

function parseRequest(value: unknown): McpRequest | null {
  if (
    !isRecord(value) ||
    value.jsonrpc !== '2.0' ||
    typeof value.method !== 'string' ||
    !value.method
  ) {
    return null;
  }
  if (value.id !== undefined && !isRpcId(value.id)) {
    return null;
  }
  if (value.params !== undefined && !isRecord(value.params)) {
    return null;
  }
  return {
    jsonrpc: '2.0',
    method: value.method,
    ...(value.id === undefined ? {} : { id: value.id }),
    ...(value.params === undefined ? {} : { params: value.params }),
  };
}

function isRpcId(value: unknown): value is JsonRpcId {
  return (
    (typeof value === 'string' && value.length <= 256) ||
    (typeof value === 'number' && Number.isSafeInteger(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResponse(
  id: JsonRpcId | null,
  code: number,
  message: string,
): McpResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
