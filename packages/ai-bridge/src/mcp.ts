import type {
  ActualiMutation,
  FinancialSnapshot,
  FinancialTransaction,
  McpCallResult,
  McpJsonSchema,
  McpTool,
  McpToolContext,
} from './contracts';
import {
  createApprovalToken,
  hashToolArguments,
  redactSnapshot,
  redactTransactions,
  securityLimits,
} from './security';
import { isIdentifier, isRecord, parseMutation } from './validation';

type ActualiMcpAdapter = {
  getSnapshot(): Promise<FinancialSnapshot> | FinancialSnapshot;
  searchTransactions(args: {
    query?: string;
    limit: number;
  }): Promise<FinancialTransaction[]> | FinancialTransaction[];
  applyMutation(args: ActualiMutation): Promise<unknown> | unknown;
};

type Approval = {
  proposalId: string;
  sessionId: string;
  mutation: ActualiMutation;
  argumentsHash: string;
  expiresAt: number;
};

const emptySchema: McpJsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const searchSchema: McpJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Payee, category, note, or date query.',
      maxLength: 200,
    },
    limit: {
      type: 'integer',
      description: 'Maximum results, capped at 50.',
      minimum: 1,
      maximum: 50,
    },
  },
  additionalProperties: false,
};

const mutationSchema: McpJsonSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', description: 'A supported Actual mutation.' },
    payload: {
      type: 'object',
      description: 'The mutation payload to preview.',
    },
  },
  required: ['action', 'payload'],
  additionalProperties: false,
};

export function createActualiMcpRegistry(adapter: ActualiMcpAdapter) {
  const approvals = new Map<string, Approval>();
  const tools: McpTool[] = [
    {
      name: 'actuali.get_snapshot',
      description: 'Read current balances, accounts, and recent activity.',
      inputSchema: emptySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    {
      name: 'actuali.search_transactions',
      description: 'Search transactions without changing budget data.',
      inputSchema: searchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    {
      name: 'actuali.propose_mutation',
      description:
        'Prepare a supported mutation for user review. This never changes budget data.',
      inputSchema: mutationSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    {
      name: 'actuali.apply_approved_mutation',
      description:
        'Apply a proposal only after the trusted host confirms it outside the model.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', minLength: 1, maxLength: 128 },
        },
        required: ['proposalId'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
  ];

  return {
    listTools(): McpTool[] {
      return tools;
    },
    async callTool(
      name: string,
      args: Record<string, unknown>,
      context: McpToolContext,
    ): Promise<McpCallResult> {
      if (!tools.some(tool => tool.name === name)) {
        return errorResult(`Unknown tool: ${name}`);
      }
      if (!context.sessionId) {
        return errorResult('A session id is required.');
      }
      if (name === 'actuali.get_snapshot') {
        if (Object.keys(args).length > 0) {
          return errorResult('This tool accepts no arguments.');
        }
        const snapshot = await adapter.getSnapshot();
        return textResult(
          context.privacyMode ? redactSnapshot(snapshot, true) : snapshot,
        );
      }
      if (name === 'actuali.search_transactions') {
        if (!isSearchArgs(args)) {
          return errorResult('Invalid search arguments.');
        }
        const results = await adapter.searchTransactions({
          query: args.query,
          limit: Math.min(args.limit ?? 20, securityLimits.maxSearchResults),
        });
        return textResult(
          context.privacyMode ? redactTransactions(results, true) : results,
        );
      }
      if (name === 'actuali.propose_mutation') {
        if (!context.canWrite) {
          return errorResult('Write tools are disabled for this session.');
        }
        const mutation = parseMutation(args);
        if (!mutation) {
          return errorResult('Unsupported or invalid mutation.');
        }
        if (approvals.size >= securityLimits.maxPendingProposals) {
          return errorResult('Too many pending proposals. Try again later.');
        }
        const proposalId = createApprovalToken();
        approvals.set(proposalId, {
          proposalId,
          sessionId: context.sessionId,
          mutation,
          argumentsHash: hashToolArguments(mutation),
          expiresAt: Date.now() + securityLimits.approvalTtlMs,
        });
        // A proposal id identifies a host-side record. Possessing it is not approval.
        return textResult({
          proposalId,
          mutation,
          expiresAt: new Date(
            Date.now() + securityLimits.approvalTtlMs,
          ).toISOString(),
          requiresExplicitHostConfirmation: true,
        });
      }
      if (name !== 'actuali.apply_approved_mutation') {
        return errorResult('Unsupported tool.');
      }
      if (!context.canWrite) {
        return errorResult('Write tools are disabled for this session.');
      }
      if (
        !isRecord(args) ||
        !hasOnlyKeys(args, ['proposalId']) ||
        !isIdentifier(args.proposalId)
      ) {
        return errorResult('A proposal id is required.');
      }
      const approval = approvals.get(args.proposalId);
      if (
        !approval ||
        approval.sessionId !== context.sessionId ||
        approval.expiresAt < Date.now()
      ) {
        return errorResult(
          'Proposal is missing, expired, or belongs to another session.',
        );
      }
      // This callback is injected by the authenticated UI/host. The model cannot set it.
      if (
        !context.isProposalApproved ||
        !(await context.isProposalApproved(
          approval.proposalId,
          approval.mutation,
        ))
      ) {
        return errorResult('The trusted host has not approved this proposal.');
      }
      if (hashToolArguments(approval.mutation) !== approval.argumentsHash) {
        return errorResult('Proposal integrity check failed.');
      }
      approvals.delete(approval.proposalId);
      return textResult(await adapter.applyMutation(approval.mutation));
    },
  };
}

function isSearchArgs(
  args: Record<string, unknown>,
): args is { query?: string; limit?: number } {
  return (
    hasOnlyKeys(args, ['query', 'limit']) &&
    (args.query === undefined ||
      (typeof args.query === 'string' && args.query.length <= 200)) &&
    (args.limit === undefined ||
      (typeof args.limit === 'number' &&
        Number.isSafeInteger(args.limit) &&
        args.limit >= 1 &&
        args.limit <= 50))
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

function textResult(value: unknown): McpCallResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function errorResult(message: string): McpCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
