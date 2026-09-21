import { createHash, randomUUID } from 'node:crypto';

import type { FinancialSnapshot, FinancialTransaction } from './contracts';

const MAX_PROMPT_LENGTH = 4000;
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|rules)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)/i,
  /you\s+are\s+now\s+(?:a|an|the)\s+/i,
  /(?:system|developer)\s*:\s*(?:override|instruction)/i,
  /<\|?(?:system|im_start|endoftext)\|?>/i,
  /\[\/?INST\]|<<SYS>>/i,
];

export type PromptSafety = {
  safe: boolean;
  value: string;
  matchedRules: string[];
};

export function sanitizePrompt(prompt: string): PromptSafety {
  const value = stripControlCharacters(prompt)
    .slice(0, MAX_PROMPT_LENGTH)
    .trim();
  const matchedRules = INJECTION_PATTERNS.flatMap((pattern, index) =>
    pattern.test(value) ? [`injection_pattern_${index + 1}`] : [],
  );
  return { safe: matchedRules.length === 0, value, matchedRules };
}

function stripControlCharacters(value: string): string {
  return [...value]
    .filter(character => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code !== 0 &&
        (code > 0x1f || code === 0x09 || code === 0x0a || code === 0x0d) &&
        code !== 0x7f
      );
    })
    .join('');
}

/** Privacy mode removes labels and notes, not amounts or dates.
 * Explicit allowlisting also prevents adapter-specific fields from escaping.
 */
export function redactTransactions(
  transactions: FinancialTransaction[],
  privacyMode: boolean,
): FinancialTransaction[] {
  return transactions.map(transaction => ({
    id: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    accountId: transaction.accountId,
    payee:
      privacyMode && transaction.payee
        ? 'Merchant redacted'
        : transaction.payee,
    category:
      privacyMode && transaction.category
        ? 'Category redacted'
        : transaction.category,
    notes: privacyMode ? null : transaction.notes,
  }));
}

export function redactSnapshot(
  snapshot: FinancialSnapshot,
  privacyMode: boolean,
): FinancialSnapshot {
  return {
    currency: snapshot.currency,
    asOf: snapshot.asOf,
    balances: {
      all: snapshot.balances.all,
      onBudget: snapshot.balances.onBudget,
      offBudget: snapshot.balances.offBudget,
    },
    accounts: snapshot.accounts.map((account, index) => ({
      id: account.id,
      name: privacyMode ? `Account ${index + 1}` : account.name,
      balance: account.balance,
      closed: account.closed,
    })),
    recentTransactions: redactTransactions(
      snapshot.recentTransactions,
      privacyMode,
    ),
  };
}

/** Hash only JSON values, with recursive key ordering and bounded traversal. */
export function hashToolArguments(args: unknown): string {
  return createHash('sha256')
    .update(stableSerialize(args, new Set(), 0))
    .digest('hex');
}

function stableSerialize(
  value: unknown,
  ancestors: Set<object>,
  depth: number,
): string {
  if (depth > 32) {
    throw new Error('Arguments exceed the maximum nesting depth.');
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || value === null || ancestors.has(value)) {
    throw new Error('Arguments must contain only acyclic JSON values.');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map(child => stableSerialize(child, ancestors, depth + 1)).join(',')}]`;
    }
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new Error('Arguments must contain only plain JSON objects.');
    }
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(
        ([key, child]) =>
          `${JSON.stringify(key)}:${stableSerialize(child, ancestors, depth + 1)}`,
      )
      .join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function createApprovalToken(): string {
  return randomUUID();
}

export const securityLimits = {
  maxPromptLength: MAX_PROMPT_LENGTH,
  approvalTtlMs: 5 * 60 * 1000,
  maxSearchResults: 50,
  maxPendingProposals: 100,
} as const;
