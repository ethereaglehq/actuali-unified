import { describe, expect, it } from 'vitest';

import { createActualiMcpRegistry } from '../src/mcp';
import { createMcpRequestHandler } from '../src/mcpProtocol';

describe('Actuali MCP registry', () => {
  const adapter = {
    getSnapshot: () => ({
      currency: 'USD',
      asOf: '2026-09-20',
      balances: { all: 0, onBudget: 0, offBudget: 0 },
      accounts: [],
      recentTransactions: [],
    }),
    searchTransactions: () => [],
    applyMutation: (args: unknown) => args,
  };

  it('requires trusted host approval and consumes a proposal once', async () => {
    const registry = createActualiMcpRegistry(adapter);
    const mutation = {
      action: 'create_transaction',
      payload: { accountId: 'acct-1', date: '2026-09-20', amount: -500 },
    } as const;
    const context = {
      sessionId: 'test-session',
      canWrite: true,
      privacyMode: true,
      isProposalApproved: () => false,
    };
    const proposal = await registry.callTool(
      'actuali.propose_mutation',
      mutation,
      context,
    );
    const proposalBody = JSON.parse(proposal.content[0].text) as {
      proposalId: string;
    };

    const denied = await registry.callTool(
      'actuali.apply_approved_mutation',
      { proposalId: proposalBody.proposalId },
      context,
    );
    expect(denied.isError).toBe(true);

    const approvedContext = { ...context, isProposalApproved: () => true };
    const applied = await registry.callTool(
      'actuali.apply_approved_mutation',
      { proposalId: proposalBody.proposalId },
      approvedContext,
    );
    expect(applied.isError).toBeUndefined();

    const replay = await registry.callTool(
      'actuali.apply_approved_mutation',
      { proposalId: proposalBody.proposalId },
      approvedContext,
    );
    expect(replay.isError).toBe(true);
  });

  it('rejects unsupported mutations and read-only writes', async () => {
    const registry = createActualiMcpRegistry(adapter);
    const invalid = await registry.callTool(
      'actuali.propose_mutation',
      { action: 'delete_transaction', payload: { id: 'tx-1' } },
      { sessionId: 'reader', canWrite: false, privacyMode: true },
    );
    expect(invalid.isError).toBe(true);
    const malformed = await registry.callTool(
      'actuali.propose_mutation',
      { action: 'create_transaction', payload: { amount: -1.2 } },
      { sessionId: 'writer', canWrite: true, privacyMode: true },
    );
    expect(malformed.isError).toBe(true);
  });

  it('redacts typed search results in privacy mode', async () => {
    const registry = createActualiMcpRegistry({
      ...adapter,
      searchTransactions: () => [
        {
          id: 'tx-1',
          date: '2026-09-20',
          amount: -10,
          accountId: 'acct-1',
          payee: 'Private merchant',
          category: 'Health',
          notes: 'secret',
        },
      ],
    });
    const result = await registry.callTool(
      'actuali.search_transactions',
      {},
      { sessionId: 'reader', canWrite: false, privacyMode: true },
    );
    const body = JSON.parse(result.content[0].text) as Array<{
      payee: string;
      notes: null;
    }>;
    expect(body[0].payee).toBe('Merchant redacted');
    expect(body[0].notes).toBeNull();
  });
});

describe('MCP JSON-RPC transport boundary', () => {
  it('serves tools through standard methods and rejects malformed requests', async () => {
    const registry = createActualiMcpRegistry({
      getSnapshot: () => ({
        currency: 'USD',
        asOf: '2026-09-20',
        balances: { all: 0, onBudget: 0, offBudget: 0 },
        accounts: [],
        recentTransactions: [],
      }),
      searchTransactions: () => [],
      applyMutation: () => ({}),
    });
    const handler = createMcpRequestHandler(registry, () => ({
      sessionId: 'mcp-test',
      canWrite: false,
      privacyMode: true,
    }));
    const tools = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    expect(tools?.result).toMatchObject({ tools: expect.any(Array) });
    const call = await handler({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'actuali.get_snapshot', arguments: {} },
    });
    expect(call?.error).toBeUndefined();
    const invalid = await handler({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'actuali.get_snapshot' },
    });
    expect(invalid?.error?.code).toBe(-32602);
    const notification = await handler({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(notification).toBeNull();
  });
});
