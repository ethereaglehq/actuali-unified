import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActualReadOnlyAdapter } from '../src/adapter';
import { ActualMcpServer, TOOLS } from '../src/mcpServer';

const api = {
  getAccounts: vi.fn(async () => [
    { id: 'account-1', name: 'Checking', offbudget: false, closed: false },
  ]),
  getAccountBalance: vi.fn(async () => 12345),
  getCategories: vi.fn(async () => [
    {
      id: 'category-1',
      name: 'Food',
      group_id: 'group-1',
      is_income: false,
      hidden: false,
    },
  ]),
  getTransactions: vi.fn(async () => [
    {
      id: 'transaction-1',
      account: 'account-1',
      date: '2026-09-20',
      amount: -1250,
      payee: null,
      category: 'category-1',
      notes: 'Lunch',
      cleared: true,
      reconciled: false,
    },
  ]),
  sync: vi.fn(async () => undefined),
};

describe('ActualMcpServer', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requires initialization and exposes only read-only tools', async () => {
    const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
    expect(
      (await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))
        ?.error?.code,
    ).toBe(-32002);
    await server.handle({ jsonrpc: '2.0', id: 2, method: 'initialize' });
    const result = await server.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
    });
    expect(result?.result).toEqual({ tools: TOOLS });
    expect(
      TOOLS.filter(tool => tool.name !== 'actuali.sync').every(
        tool => tool.annotations.readOnlyHint === true,
      ),
    ).toBe(true);
  });

  it('validates date ranges and caps transaction search', async () => {
    const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
    await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    const invalid = await server.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'actuali.search_transactions',
        arguments: { startDate: '2026-09-21', endDate: '2026-09-20' },
      },
    });
    expect(invalid?.result).toMatchObject({ isError: true });
    const valid = await server.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'actuali.search_transactions',
        arguments: {
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          query: 'lunch',
          limit: 1,
        },
      },
    });
    expect(valid?.result).toMatchObject({
      structuredContent: { data: [{ id: 'transaction-1' }] },
    });
    expect(api.getTransactions).toHaveBeenCalledWith(
      'account-1',
      '2026-09-01',
      '2026-09-30',
    );
  });

  it('rejects malformed JSON-RPC envelopes without invoking the adapter', async () => {
    const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
    const result = await server.handle({
      jsonrpc: '1.0',
      id: {},
      method: 'initialize',
    });
    expect(result?.error).toMatchObject({ code: -32600 });
    expect(api.getAccounts).not.toHaveBeenCalled();
  });

  it.each([
    { id: 1, method: 'initialize' },
    { jsonrpc: '1.0', id: 1, method: 'initialize' },
    { jsonrpc: '2.0', id: {}, method: 'initialize' },
    { jsonrpc: '2.0', id: Infinity, method: 'initialize' },
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: [] },
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: null },
    null,
    [],
  ])('rejects an invalid envelope: %j', async request => {
    const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
    expect((await server.handle(request))?.error?.code).toBe(-32600);
  });

  it.each([null, [], false, 'secret'])(
    'rejects invalid arguments: %j',
    async args => {
      const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
      await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
      const result = await server.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'actuali.get_accounts', arguments: args },
      });
      expect(result?.result).toMatchObject({ isError: true });
      expect(api.getAccounts).not.toHaveBeenCalled();
    },
  );

  it('does not disclose upstream API error details', async () => {
    api.getAccounts.mockRejectedValueOnce(new Error('password=secret'));
    const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
    await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    const result = await server.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'actuali.get_accounts' },
    });
    expect(result?.result).toMatchObject({
      isError: true,
      content: [{ text: 'Actual data request failed' }],
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('marks sync as an explicit network side effect', async () => {
    const server = new ActualMcpServer(new ActualReadOnlyAdapter(api));
    await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    const result = await server.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'actuali.sync', arguments: {} },
    });
    expect(result?.result).toMatchObject({
      structuredContent: { data: { synced: true } },
    });
    expect(api.sync).toHaveBeenCalledOnce();
    expect(
      TOOLS.find(tool => tool.name === 'actuali.sync')?.annotations,
    ).toMatchObject({ readOnlyHint: false, openWorldHint: true });
  });
});
