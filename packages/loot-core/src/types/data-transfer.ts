export const TRANSFER_SECTIONS = [
  'payees',
  'rules',
  'tags',
  'schedules',
  'reports',
] as const;
export type TransferSection = (typeof TRANSFER_SECTIONS)[number];
export type TransferResult = {
  counts: Partial<Record<TransferSection, number>>;
  imported: number;
  skipped: number;
  warnings: string[];
};
