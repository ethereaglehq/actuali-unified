export class InputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export type SearchTransactionsInput = {
  accountId?: string;
  query?: string;
  startDate: string;
  endDate: string;
  limit: number;
};

export function validateDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputValidationError(`${field} must be an ISO date (YYYY-MM-DD)`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new InputValidationError(`${field} is not a valid calendar date`);
  }
  return value;
}

export function validateSearchInput(input: unknown): SearchTransactionsInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new InputValidationError('arguments must be an object');
  }
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      key =>
        !['accountId', 'query', 'startDate', 'endDate', 'limit'].includes(key),
    )
  ) {
    throw new InputValidationError('Unexpected transaction search field');
  }
  if (typeof value.query === 'string' && value.query.length > 200) {
    throw new InputValidationError('query must contain at most 200 characters');
  }
  const startDate = validateDate(value.startDate, 'startDate');
  const endDate = validateDate(value.endDate, 'endDate');
  if (startDate > endDate) {
    throw new InputValidationError(
      'startDate must be before or equal to endDate',
    );
  }
  if (value.accountId !== undefined && typeof value.accountId !== 'string') {
    throw new InputValidationError('accountId must be a string');
  }
  if (value.query !== undefined && typeof value.query !== 'string') {
    throw new InputValidationError('query must be a string');
  }
  const limit = value.limit === undefined ? 50 : value.limit;
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new InputValidationError(
      'limit must be an integer between 1 and 100',
    );
  }
  return {
    accountId: value.accountId as string | undefined,
    query: value.query as string | undefined,
    startDate,
    endDate,
    limit,
  };
}
