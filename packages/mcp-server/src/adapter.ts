export type ActualAccount = {
  id: string;
  name: string;
  offbudget?: boolean;
  closed?: boolean;
};

export type ActualCategory = {
  id: string;
  name: string;
  group_id: string;
  is_income?: boolean;
  hidden?: boolean;
};

export type ActualTransaction = {
  id: string;
  account: string;
  date: string;
  amount: number;
  payee?: string | null;
  category?: string;
  notes?: string;
  cleared?: boolean;
  reconciled?: boolean;
};

export type ActualReadOnlyApi = {
  getAccounts(): Promise<ActualAccount[]>;
  getAccountBalance(id: string): Promise<number | null>;
  getCategories(options?: { hidden?: boolean }): Promise<ActualCategory[]>;
  getTransactions(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<ActualTransaction[]>;
  sync(): Promise<unknown>;
};

export type ReadOnlyAccount = {
  id: string;
  name: string;
  offbudget: boolean;
  closed: boolean;
  balance: number | null;
};

export type ReadOnlyTransaction = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  payeeId: string | null;
  categoryId: string | null;
  notes: string | null;
  cleared: boolean;
  reconciled: boolean;
};

export type ReadOnlyCategory = {
  id: string;
  name: string;
  groupId: string;
  isIncome: boolean;
  hidden: boolean;
};

function toAccount(
  account: ActualAccount,
  balance: number | null,
): ReadOnlyAccount {
  return {
    id: account.id,
    name: account.name,
    offbudget: account.offbudget === true,
    closed: account.closed === true,
    balance,
  };
}

function toTransaction(transaction: ActualTransaction): ReadOnlyTransaction {
  return {
    id: transaction.id,
    accountId: transaction.account,
    date: transaction.date,
    amount: transaction.amount,
    payeeId: transaction.payee ?? null,
    categoryId: transaction.category ?? null,
    notes: transaction.notes ?? null,
    cleared: transaction.cleared === true,
    reconciled: transaction.reconciled === true,
  };
}

function toCategory(category: ActualCategory): ReadOnlyCategory {
  return {
    id: category.id,
    name: category.name,
    groupId: category.group_id,
    isIncome: category.is_income === true,
    hidden: category.hidden === true,
  };
}

export class ActualReadOnlyAdapter {
  public constructor(private readonly api: ActualReadOnlyApi) {}

  public async getAccounts(): Promise<ReadOnlyAccount[]> {
    const accounts = await this.api.getAccounts();
    return Promise.all(
      accounts.map(async account => {
        const balance = await this.api.getAccountBalance(account.id);
        return toAccount(account, typeof balance === 'number' ? balance : null);
      }),
    );
  }

  public async getCategories(): Promise<ReadOnlyCategory[]> {
    const categories = await this.api.getCategories({ hidden: true });
    return categories.map(toCategory);
  }

  public async searchTransactions(input: {
    accountId?: string;
    query?: string;
    startDate: string;
    endDate: string;
    limit: number;
  }): Promise<ReadOnlyTransaction[]> {
    const accounts = input.accountId
      ? [{ id: input.accountId }]
      : await this.api.getAccounts();
    const results: ReadOnlyTransaction[] = [];
    for (const account of accounts) {
      const transactions = await this.api.getTransactions(
        account.id,
        input.startDate,
        input.endDate,
      );
      for (const transaction of transactions) {
        const mapped = toTransaction(transaction);
        const needle = input.query?.trim().toLocaleLowerCase();
        if (
          needle &&
          !JSON.stringify(mapped).toLocaleLowerCase().includes(needle)
        ) {
          continue;
        }
        results.push(mapped);
      }
    }
    return results
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, input.limit);
  }

  public async sync(): Promise<{ synced: true; warning: string }> {
    await this.api.sync();
    return {
      synced: true,
      warning:
        "Sync can contact the configured Actual server and update Actual's local sync state. This host exposes no budget mutation tools.",
    };
  }
}
