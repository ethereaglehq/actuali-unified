import type { ActualiMutation } from './contracts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every(key => allowedKeys.includes(key));
}

export function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    [...value].every(character => (character.codePointAt(0) ?? 0) >= 0x20)
  );
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Return a new allowlisted object so a caller cannot modify a stored proposal. */
export function parseMutation(value: unknown): ActualiMutation | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['action', 'payload']) ||
    !isRecord(value.payload)
  ) {
    return null;
  }
  const payload = value.payload;
  if (value.action === 'set_transaction_category') {
    if (
      !hasOnlyKeys(payload, ['transactionId', 'categoryId']) ||
      !isIdentifier(payload.transactionId) ||
      !isIdentifier(payload.categoryId)
    ) {
      return null;
    }
    return {
      action: value.action,
      payload: {
        transactionId: payload.transactionId,
        categoryId: payload.categoryId,
      },
    };
  }
  if (value.action !== 'create_transaction') {
    return null;
  }
  if (
    !hasOnlyKeys(payload, [
      'accountId',
      'date',
      'amount',
      'payeeId',
      'categoryId',
      'notes',
    ]) ||
    !isIdentifier(payload.accountId) ||
    !isDate(payload.date) ||
    typeof payload.amount !== 'number' ||
    !Number.isSafeInteger(payload.amount) ||
    (payload.payeeId !== undefined && !isIdentifier(payload.payeeId)) ||
    (payload.categoryId !== undefined && !isIdentifier(payload.categoryId)) ||
    (payload.notes !== undefined &&
      (typeof payload.notes !== 'string' || payload.notes.length > 2000))
  ) {
    return null;
  }
  return {
    action: value.action,
    payload: {
      accountId: payload.accountId,
      date: payload.date,
      amount: payload.amount,
      ...(payload.payeeId === undefined ? {} : { payeeId: payload.payeeId }),
      ...(payload.categoryId === undefined
        ? {}
        : { categoryId: payload.categoryId }),
      ...(payload.notes === undefined ? {} : { notes: payload.notes }),
    },
  };
}
