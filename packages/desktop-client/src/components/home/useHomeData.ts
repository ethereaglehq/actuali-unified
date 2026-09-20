import { useMemo } from 'react';

import { q } from '@actual-app/core/shared/query';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { useAccountBalances } from '#hooks/useAccountBalances';
import { useAccounts } from '#hooks/useAccounts';
import { usePayees } from '#hooks/usePayees';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { useTransactions } from '#hooks/useTransactions';
import {
  allAccountBalance,
  offBudgetAccountBalance,
  onBudgetAccountBalance,
} from '#spreadsheet/bindings';

export type HomeData = {
  activeAccounts: NonNullable<ReturnType<typeof useAccounts>['data']>;
  accountBalances: Record<string, number | null>;
  allBalance: number | null;
  onBudgetBalance: number | null;
  offBudgetBalance: number | null;
  recentTransactions: ReadonlyArray<TransactionEntity>;
  payees: NonNullable<ReturnType<typeof usePayees>['data']>;
  isLoading: boolean;
  syncStatus: ReturnType<typeof useSyncServerStatus>;
};

/**
 * Shared read model for the mobile and desktop home surfaces.
 *
 * All values come from Actual's existing query and spreadsheet bindings, so
 * this surface remains local-first and updates when a CRDT sync applies.
 */
export function useHomeData(): HomeData {
  const accountsQuery = useAccounts();
  const payeesQuery = usePayees();
  const accounts = accountsQuery.data ?? [];
  const activeAccounts = useMemo(
    () => accounts.filter(account => !account.closed),
    [accounts],
  );
  const accountBalances = useAccountBalances(activeAccounts.map(a => a.id));
  const recentTransactionsQuery = useMemo(
    () =>
      q('transactions')
        .options({ splits: 'grouped' })
        .filter({ is_child: false })
        .orderBy({ date: 'desc' }),
    [],
  );
  const transactionsQuery = useTransactions({
    query: recentTransactionsQuery,
    options: { pageSize: 7 },
  });

  return {
    activeAccounts,
    accountBalances,
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
    syncStatus: useSyncServerStatus(),
  };
}
