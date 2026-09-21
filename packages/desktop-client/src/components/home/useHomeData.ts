import { useMemo } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useAccounts } from '#hooks/useAccounts';
import { usePayees } from '#hooks/usePayees';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { useSyncStatus } from '#hooks/useSyncStatus';
import { useTransactions } from '#hooks/useTransactions';
import {
  allAccountBalance,
  offBudgetAccountBalance,
  onBudgetAccountBalance,
} from '#spreadsheet/bindings';

export type HomeData = {
  accounts: NonNullable<ReturnType<typeof useAccounts>['data']>;
  activeAccounts: NonNullable<ReturnType<typeof useAccounts>['data']>;
  allBalance: number | null;
  onBudgetBalance: number | null;
  offBudgetBalance: number | null;
  recentTransactions: ReadonlyArray<TransactionEntity>;
  payees: NonNullable<ReturnType<typeof usePayees>['data']>;
  isLoading: boolean;
  isError: boolean;
  retry: () => Promise<void>;
  syncStatus: ReturnType<typeof useSyncServerStatus>;
  isSyncing: boolean;
  syncState: ReturnType<typeof useSyncStatus>['syncState'];
};

/**
 * Home is a resilient summary surface. A legacy or partially imported row
 * should never take down the entire page just because its date is malformed.
 */
export function formatHomeDate(
  date: unknown,
  dateFormat: string,
): string | null {
  if (typeof date !== 'string' || !monthUtils.isValidYearMonthDay(date)) {
    return null;
  }

  try {
    return monthUtils.format(date, dateFormat);
  } catch {
    return null;
  }
}

/**
 * Shared read model for the mobile and desktop home surfaces.
 *
 * All values come from Actual's existing query and spreadsheet bindings, so
 * this surface remains local-first and updates when a CRDT sync applies.
 */
export function useHomeData(): HomeData {
  const accountsQuery = useAccounts();
  const payeesQuery = usePayees();
  const accountsData = accountsQuery.data;
  const accounts = accountsData ?? [];
  const activeAccounts = useMemo(
    () => (accountsData ?? []).filter(account => !account.closed),
    [accountsData],
  );
  const recentTransactionsQuery = useMemo(
    () =>
      q('transactions')
        .options({ splits: 'grouped' })
        .select('*')
        .filter({ is_child: false })
        .orderBy({ date: 'desc' }),
    [],
  );
  const transactionsQuery = useTransactions({
    query: recentTransactionsQuery,
    options: { pageSize: 7 },
  });
  const { isSyncing, syncState } = useSyncStatus();

  const isError =
    accountsQuery.isError || payeesQuery.isError || transactionsQuery.isError;
  const retry = async () => {
    await Promise.all([
      accountsQuery.refetch(),
      payeesQuery.refetch(),
      transactionsQuery.refetch(),
    ]);
  };

  return {
    accounts,
    activeAccounts,
    allBalance: useSheetValue<'account', 'accounts-balance'>(
      allAccountBalance(),
    ),
    onBudgetBalance: useSheetValue<'account', 'onbudget-accounts-balance'>(
      onBudgetAccountBalance(),
    ),
    offBudgetBalance: useSheetValue<'account', 'offbudget-accounts-balance'>(
      offBudgetAccountBalance(),
    ),
    recentTransactions: transactionsQuery.transactions,
    payees: payeesQuery.data ?? [],
    isLoading:
      accountsQuery.isPending ||
      payeesQuery.isPending ||
      transactionsQuery.isPending,
    isError,
    retry,
    syncStatus: useSyncServerStatus(),
    isSyncing,
    syncState,
  };
}
