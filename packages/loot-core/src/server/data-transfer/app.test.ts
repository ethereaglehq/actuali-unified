import type { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

import { app } from '#server/data-transfer/app';
import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { loadRules, resetState } from '#server/transactions/transaction-rules';

// The shared test setup mocks uuid.v4; this module also needs the v5 helper.
vi.mock('uuid', async importOriginal => {
  const actual = await importOriginal<{
    v4: typeof uuidv4;
    v5: typeof uuidv5;
  }>();
  return { ...actual, v4: actual.v4 };
});

beforeEach(async () => {
  await global.emptyDatabase()();
  resetState();
  await loadMappings();
  await loadRules();
});

type TransferPayload = Parameters<
  (typeof app.handlers)['data-transfer-import']
>[0]['payload'];

function payload(): TransferPayload {
  return {
    format: 'actuali-data',
    version: 1,
    references: {
      account: [{ id: 'source-account', name: 'Shared Checking' }],
      category_group: [{ id: 'source-group', name: 'Expenses' }],
      category: [{ id: 'source-category', name: 'Dining', group: 'Expenses' }],
      payee: [{ id: 'source-payee', name: 'Cafe' }],
      schedule: [{ id: 'source-schedule', name: 'Rent' }],
    },
    sections: {
      payees: [
        {
          id: 'source-payee',
          name: 'Cafe',
          favorite: true,
          learn_categories: true,
        },
      ],
      tags: [
        {
          id: 'source-tag',
          tag: 'Reimbursable',
          color: '#0a6',
          description: 'Needs reimbursement',
          hidden: false,
        },
      ],
      rules: [
        {
          id: 'source-rule',
          stage: 'pre',
          conditionsOp: 'and',
          conditions: [
            { op: 'is', field: 'account', value: 'source-account' },
            { op: 'is', field: 'category', value: 'source-category' },
          ],
          actions: [{ op: 'set', field: 'category', value: 'source-category' }],
        },
      ],
      schedules: [
        {
          id: 'source-schedule',
          name: 'Rent',
          next_date: '2030-01-01',
          completed: false,
          posts_transaction: true,
          rule: {
            stage: null,
            conditionsOp: 'and',
            conditions: [
              { op: 'is', field: 'account', value: 'source-account' },
              { op: 'is', field: 'date', value: '2030-01-01' },
            ],
            actions: [{ op: 'link-schedule', value: 'source-schedule' }],
          },
        },
      ],
      reports: [
        {
          id: 'source-report',
          name: 'Dining by account',
          conditionsOp: 'and',
          conditions: [{ op: 'is', field: 'account', value: 'source-account' }],
          startDate: '',
          endDate: '',
          dateRange: '',
          mode: '',
          groupBy: '',
          interval: '',
          balanceType: '',
          graphType: '',
          sortBy: 'desc',
        },
      ],
    },
  };
}

async function createCoreReferences(prefix = 'target') {
  const accountId = await db.insertAccount({
    id: `${prefix}-account`,
    name: 'Shared Checking',
  });
  const groupId = await db.insertCategoryGroup({
    id: `${prefix}-group`,
    name: 'Expenses',
  });
  const categoryId = await db.insertCategory({
    id: `${prefix}-category`,
    name: 'Dining',
    cat_group: groupId,
  });
  return { accountId, categoryId };
}

describe('data transfer app', () => {
  it('exports and imports all five sections into a fresh budget', async () => {
    await createCoreReferences();
    const sourceResult = await app.handlers['data-transfer-import']({
      mode: 'apply',
      sections: ['payees', 'rules', 'tags', 'schedules', 'reports'],
      payload: payload(),
    });
    expect(sourceResult.imported).toBe(5);

    const exported = await app.handlers['data-transfer-export']({
      sections: ['payees', 'rules', 'tags', 'schedules', 'reports'],
    });
    const exportedPayload = JSON.parse(exported.contents);
    expect(Object.keys(exportedPayload.sections).sort()).toEqual([
      'payees',
      'reports',
      'rules',
      'schedules',
      'tags',
    ]);

    await global.emptyDatabase()();
    resetState();
    await loadMappings();
    await loadRules();
    const { accountId, categoryId } = await createCoreReferences('renamed');
    const result = await app.handlers['data-transfer-import']({
      mode: 'apply',
      sections: ['payees', 'rules', 'tags', 'schedules', 'reports'],
      payload: exportedPayload,
    });

    expect(result.imported).toBe(5);
    const importedRule = await db.first<{
      conditions: string;
      actions: string;
    }>(
      "SELECT conditions, actions FROM rules WHERE actions NOT LIKE '%link-schedule%'",
      [],
    );
    expect(JSON.parse(importedRule!.conditions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'acct', value: accountId }),
        expect.objectContaining({ field: 'category', value: categoryId }),
      ]),
    );
    const schedule = await db.first<{
      posts_transaction: number;
      id: string;
      rule: string;
    }>('SELECT id, posts_transaction, rule FROM schedules WHERE name = ?', [
      'Rent',
    ]);
    expect(schedule?.posts_transaction).toBe(0);
    const nextDate = await db.first<{ local_next_date: number }>(
      'SELECT local_next_date FROM schedules_next_date WHERE schedule_id = ?',
      [schedule?.id ?? 'missing'],
    );
    expect(nextDate).toBeTruthy();
  });

  it('previews without writing and skips duplicate sections on reimport', async () => {
    const before = await db.getTags();
    const preview = await app.handlers['data-transfer-import']({
      mode: 'preview',
      sections: ['tags'],
      payload: payload(),
    });
    expect(preview.imported).toBe(1);
    expect(await db.getTags()).toEqual(before);

    const first = await app.handlers['data-transfer-import']({
      mode: 'apply',
      sections: ['tags'],
      payload: payload(),
    });
    expect(first.imported).toBe(1);
    const second = await app.handlers['data-transfer-import']({
      mode: 'apply',
      sections: ['tags'],
      payload: payload(),
    });
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it('rejects unresolved references atomically', async () => {
    const invalid = payload() as {
      sections: { rules: Array<Record<string, unknown>> };
    };
    invalid.sections.rules = [
      {
        ...invalid.sections.rules[0],
        conditions: [{ op: 'is', field: 'account', value: 'missing-account' }],
      },
    ];
    await expect(
      app.handlers['data-transfer-import']({
        mode: 'apply',
        sections: ['rules'],
        payload: invalid,
      }),
    ).rejects.toThrow(/Unresolved account reference/);
    expect(await db.all('SELECT id FROM rules')).toEqual([]);
  });
});
