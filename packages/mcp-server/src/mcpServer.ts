import { createInterface } from 'node:readline';

import type { ActualReadOnlyAdapter } from './adapter.js';
import { InputValidationError, validateSearchInput } from './validation.js';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

const SERVER_INFO = {
  name: 'actuali-mcp',
  version: '0.1.0',
};

const TOOLS = [
  {
    name: 'actuali.get_accounts',
    description:
      'List accounts and their current balances from the loaded Actual budget. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'actuali.get_categories',
    description:
      'List visible and hidden categories from the loaded Actual budget. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'actuali.search_transactions',
    description:
      'Search transactions within an explicit date range. Results are capped at 100. Read-only.',
    inputSchema: {
      type: 'object',
      required: ['startDate', 'endDate'],
      properties: {
        accountId: { type: 'string' },
        query: { type: 'string', maxLength: 200 },
        startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'actuali.sync',
    description:
      'Synchronize the loaded budget with its configured server. This contacts the network and updates local sync state; it exposes no transaction or budget editing parameters.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
] as const;

function response(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function errorResponse(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function textResult(value: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: { data: value },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidId(
  value: unknown,
): value is string | number | null | undefined {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isValidRequest(value: unknown): value is JsonRpcRequest {
  return (
    isObject(value) &&
    value.jsonrpc === '2.0' &&
    typeof value.method === 'string' &&
    value.method.length > 0 &&
    isValidId(value.id) &&
    (value.params === undefined || isObject(value.params))
  );
}

export class ActualMcpServer {
  private initialized = false;

  public constructor(private readonly adapter: ActualReadOnlyAdapter) {}

  public async handle(request: unknown): Promise<JsonRpcResponse | null> {
    if (!isValidRequest(request)) {
      return errorResponse(null, -32600, 'Invalid JSON-RPC request');
    }
    if (request.id === undefined) return null;
    if (
      request.method === 'notifications/initialized' ||
      request.method === 'notifications/cancelled'
    ) {
      return null;
    }
    if (request.method === 'initialize') {
      this.initialized = true;
      return response(request.id, {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Actuali MCP is read-only. Confirm dates and context before making financial decisions.',
      });
    }
    if (!this.initialized) {
      return errorResponse(
        request.id,
        -32002,
        'Server must be initialized first',
      );
    }
    if (request.method === 'ping') return response(request.id, {});
    if (request.method === 'tools/list') {
      return response(request.id, { tools: TOOLS });
    }
    if (request.method !== 'tools/call') {
      return errorResponse(request.id, -32601, 'Unknown method');
    }

    const params = request.params ?? {};
    const name = params.name;
    const args = params.arguments === undefined ? {} : params.arguments;
    if (typeof name !== 'string' || !TOOLS.some(tool => tool.name === name)) {
      return errorResponse(request.id, -32602, 'Unknown tool');
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return response(request.id, {
        content: [{ type: 'text', text: 'arguments must be an object' }],
        isError: true,
      });
    }
    if (
      name !== 'actuali.search_transactions' &&
      Object.keys(args).length > 0
    ) {
      return errorResponse(
        request.id,
        -32602,
        'This tool accepts no arguments',
      );
    }
    try {
      let result: unknown;
      if (name === 'actuali.get_accounts') {
        result = await this.adapter.getAccounts();
      }
      if (name === 'actuali.get_categories') {
        result = await this.adapter.getCategories();
      }
      if (name === 'actuali.search_transactions') {
        result = await this.adapter.searchTransactions(
          validateSearchInput(args),
        );
      }
      if (name === 'actuali.sync') result = await this.adapter.sync();
      return response(request.id, textResult(result));
    } catch (error) {
      const message =
        error instanceof InputValidationError
          ? error.message
          : 'Actual data request failed';
      return response(request.id, {
        content: [{ type: 'text', text: message }],
        isError: true,
      });
    }
  }
}

export async function runStdioServer(server: ActualMcpServer): Promise<void> {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    if (line.length > 256_000) {
      process.stdout.write(
        `${JSON.stringify(errorResponse(null, -32600, 'Request is too large'))}\n`,
      );
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      process.stdout.write(
        `${JSON.stringify(errorResponse(null, -32700, 'Invalid JSON'))}\n`,
      );
      continue;
    }
    const result = await server.handle(parsed);
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}

export { TOOLS };
