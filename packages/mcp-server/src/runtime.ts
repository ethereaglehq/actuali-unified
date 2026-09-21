import { createRequire } from 'node:module';

import type { ActualReadOnlyApi } from './adapter.js';
import { ActualReadOnlyAdapter } from './adapter.js';
import { ActualMcpServer, runStdioServer } from './mcpServer.js';

type Budget = {
  id?: string;
  name: string;
  cloudFileId: string;
  state?: 'remote';
};

type ActualApiModule = ActualReadOnlyApi & {
  init(config?: Record<string, unknown>): Promise<unknown>;
  shutdown(): Promise<void>;
  getBudgets(): Promise<Budget[]>;
  loadBudget(id: string): Promise<unknown>;
  downloadBudget(
    syncId: string,
    options?: { password?: string },
  ): Promise<unknown>;
};

const require = createRequire(import.meta.url);

function env(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

export async function startFromEnvironment(): Promise<void> {
  const serverURL = env('ACTUAL_SERVER_URL');
  const password = env('ACTUAL_SERVER_PASSWORD');
  const sessionToken = env('ACTUAL_SESSION_TOKEN');
  const dataDir = env('ACTUAL_DATA_DIR');
  const requestedBudget = env('ACTUAL_BUDGET_ID') ?? env('ACTUAL_SYNC_FILE_ID');
  const encryptionPassword = env('ACTUAL_BUDGET_ENCRYPTION_PASSWORD');

  if (!requestedBudget) {
    throw new Error('Set ACTUAL_BUDGET_ID or ACTUAL_SYNC_FILE_ID');
  }
  if (serverURL && password && sessionToken) {
    throw new Error(
      'Set only one of ACTUAL_SERVER_PASSWORD or ACTUAL_SESSION_TOKEN',
    );
  }
  const config = serverURL
    ? sessionToken
      ? { serverURL, sessionToken, ...(dataDir ? { dataDir } : {}) }
      : password
        ? { serverURL, password, ...(dataDir ? { dataDir } : {}) }
        : { serverURL, ...(dataDir ? { dataDir } : {}) }
    : dataDir
      ? { dataDir }
      : {};

  const api = require('@actual-app/api') as ActualApiModule;
  await api.init(config);
  const budgets = await api.getBudgets();
  const budget = requestedBudget
    ? budgets.find(
        item =>
          item.id === requestedBudget ||
          item.cloudFileId === requestedBudget ||
          item.name === requestedBudget,
      )
    : budgets[0];
  if (!budget) {
    await api.shutdown();
    throw new Error(
      requestedBudget
        ? `Budget not found: ${requestedBudget}`
        : 'No Actual budgets found',
    );
  }

  if (
    budget.state === 'remote' ||
    (requestedBudget && budget.cloudFileId === requestedBudget)
  ) {
    await api.downloadBudget(budget.cloudFileId, {
      password: encryptionPassword,
    });
  } else {
    await api.loadBudget(budget.id ?? budget.name);
  }

  process.stderr.write('Actuali MCP ready\n');
  try {
    await runStdioServer(new ActualMcpServer(new ActualReadOnlyAdapter(api)));
  } finally {
    await api.shutdown();
  }
}
