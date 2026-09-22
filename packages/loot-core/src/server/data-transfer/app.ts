import { v5 as uuidv5 } from 'uuid';

import { createApp } from '#server/app';
import { aqlQuery } from '#server/aql';
import * as db from '#server/db';
import { mutator } from '#server/mutators';
import { app as payeesApp } from '#server/payees/app';
import { reportModel, app as reportsApp } from '#server/reports/app';
import { app as rulesApp } from '#server/rules/app';
import { batchMessages } from '#server/sync';
import { app as tagsApp } from '#server/tags/app';
import { insertRule, ruleModel } from '#server/transactions/transaction-rules';
import { undoable } from '#server/undo';
import { isValidYearMonthDay } from '#shared/months';
import { q } from '#shared/query';
import { getNextDate } from '#shared/schedules';
import { TRANSFER_SECTIONS } from '#types/data-transfer';
import type { TransferResult, TransferSection } from '#types/data-transfer';
import type {
  CustomReportEntity,
  RuleEntity,
  ScheduleEntity,
} from '#types/models';

type Row = Record<string, unknown>;
type Reference = {
  id: string;
  name: string;
  group?: string;
  transfer?: string;
};
type ReferenceKind =
  | 'account'
  | 'category'
  | 'category_group'
  | 'payee'
  | 'schedule';
type References = Record<ReferenceKind, Reference[]>;
const LIMIT = 10000;
const MAX_BYTES = 10 * 1024 * 1024;
const NAMESPACE = 'ed6dfb1c-0f03-4cc2-972b-7bb50b8e5331';
const refKinds: ReferenceKind[] = [
  'account',
  'category',
  'category_group',
  'payee',
  'schedule',
];

type TransferFile = {
  format: 'actuali-data';
  version: 1;
  sections: Partial<Record<TransferSection, Row[]>>;
  references: References;
};

function object(value: unknown, label: string): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Row;
}
function string(value: unknown, label: string, empty = false): string {
  if (
    typeof value !== 'string' ||
    (!empty && !value.trim()) ||
    value.length > 10000
  ) {
    throw new Error(`${label} must be text of at most 10,000 characters.`);
  }
  return value;
}
function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > LIMIT) {
    throw new Error(`${label} must be a list of at most ${LIMIT} items.`);
  }
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be true or false.`);
  }
  return value;
}
function sections(value: unknown): TransferSection[] {
  const selected = list(value, 'Sections');
  if (
    !selected.length ||
    selected.some(item => !TRANSFER_SECTIONS.some(section => section === item))
  ) {
    throw new Error('Select at least one supported section.');
  }
  return [...new Set(selected)] as TransferSection[];
}
function parseFile(value: unknown): TransferFile {
  if (JSON.stringify(value)?.length > MAX_BYTES) {
    throw new Error('Transfer files must be smaller than 10 MB.');
  }
  const file = object(value, 'Transfer file');
  if (file.format !== 'actuali-data' || file.version !== 1) {
    throw new Error(
      'Choose an Actuali selective export, version 1. Full budget backups use the budget chooser.',
    );
  }
  const source = object(file.sections, 'Sections');
  const parsed: TransferFile['sections'] = {};
  for (const key of TRANSFER_SECTIONS) {
    if (source[key] !== undefined) {
      const ids = new Set<string>();
      parsed[key] = list(source[key], key).map(value => {
        const row = object(value, key);
        const id = string(row.id, `${key} ID`);
        if (ids.has(id)) throw new Error(`Duplicate ${key} ID in this file.`);
        ids.add(id);
        return row;
      });
    }
  }
  if (!Object.keys(parsed).length) {
    throw new Error('No supported sections in this file.');
  }
  const refs = object(file.references, 'References');
  const references = {} as References;
  for (const kind of refKinds) {
    const ids = new Set<string>();
    references[kind] = list(refs[kind] ?? [], `${kind} references`).map(
      value => {
        const item = object(value, 'Reference');
        const id = string(item.id, 'Reference ID');
        if (ids.has(id)) throw new Error('Duplicate reference ID.');
        ids.add(id);
        return {
          id,
          name: string(item.name, 'Reference name', true),
          ...(item.group !== undefined
            ? { group: string(item.group, 'Category group', true) }
            : {}),
          ...(item.transfer !== undefined
            ? { transfer: string(item.transfer, 'Transfer account') }
            : {}),
        };
      },
    );
  }
  return { format: 'actuali-data', version: 1, sections: parsed, references };
}

async function references(): Promise<References> {
  const accounts = await db.all<{ id: string; name: string }>(
    'SELECT id, name FROM accounts WHERE tombstone = 0',
  );
  const groups = await db.all<{ id: string; name: string }>(
    'SELECT id, name FROM category_groups WHERE tombstone = 0',
  );
  const categories = await db.all<{ id: string; name: string; group: string }>(
    'SELECT c.id, c.name, g.name AS "group" FROM categories c LEFT JOIN category_groups g ON c.cat_group = g.id WHERE c.tombstone = 0',
  );
  const payees = await db.all<{
    id: string;
    name: string;
    transfer_acct: string | null;
  }>('SELECT id, name, transfer_acct FROM payees WHERE tombstone = 0');
  const schedules = await db.all<{ id: string; name: string | null }>(
    'SELECT id, name FROM schedules WHERE tombstone = 0',
  );
  return {
    account: accounts,
    category_group: groups,
    category: categories.map(item => ({ ...item, group: item.group ?? '' })),
    payee: payees.map(item => ({
      id: item.id,
      name: item.name ?? '',
      ...(item.transfer_acct ? { transfer: item.transfer_acct } : {}),
    })),
    schedule: schedules.map(item => ({ id: item.id, name: item.name ?? '' })),
  };
}

async function exportData(args: { sections: TransferSection[] }) {
  const selected = sections(args.sections);
  const refs = await references();
  const output: TransferFile['sections'] = {};
  const rules = await rulesApp.handlers['rules-get']();
  const { data: schedules }: { data: ScheduleEntity[] } = await aqlQuery(
    q('schedules').select('*'),
  );
  const scheduleRules = new Set(schedules.map(item => item.rule));
  for (const section of selected) {
    switch (section) {
      case 'payees':
        output.payees = (await payeesApp.handlers['payees-get']())
          .filter(item => !item.transfer_acct)
          .map(item => ({
            id: item.id,
            name: item.name,
            favorite: !!item.favorite,
            learn_categories: !!item.learn_categories,
          }));
        break;
      case 'tags':
        output.tags = (await tagsApp.handlers['tags-get']()).map(item => ({
          ...item,
        }));
        break;
      case 'rules':
        output.rules = rules
          .filter(item => !scheduleRules.has(item.id))
          .map(item => ({ ...item }));
        break;
      case 'schedules':
        output.schedules = schedules.map(item => {
          const rule = rules.find(rule => rule.id === item.rule);
          if (!rule) {
            throw new Error(
              'A schedule is missing its rule. Repair it before exporting.',
            );
          }
          return {
            id: item.id,
            name: item.name ?? '',
            next_date: item.next_date,
            completed: !!item.completed,
            posts_transaction: !!item.posts_transaction,
            rule,
          };
        });
        break;
      case 'reports':
        output.reports = (await reportsApp.handlers['report/get']()).map(
          ({ metadata: _metadata, ...item }) => ({ ...item }),
        );
        break;
      default:
        throw new Error('Unsupported transfer section.');
    }
  }
  const payload: TransferFile = {
    format: 'actuali-data',
    version: 1,
    sections: output,
    references: refs,
  };
  const contents = JSON.stringify(payload, null, 2);
  if (new TextEncoder().encode(contents).length > MAX_BYTES) {
    throw new Error(
      'This export exceeds 10 MB. Export fewer sections at a time.',
    );
  }
  return { contents, filename: `actuali-${selected.join('-')}.json` };
}

type Write = { table: string; row: Row };
async function importData(args: {
  mode: 'preview' | 'apply';
  sections: TransferSection[];
  payload: unknown;
}): Promise<TransferResult> {
  if (!['preview', 'apply'].includes(args.mode)) {
    throw new Error('Invalid import mode.');
  }
  const selected = sections(args.sections);
  const file = parseFile(args.payload);
  const target = await references();
  const maps = Object.fromEntries(
    refKinds.map(kind => [kind, new Map<string, string>()]),
  ) as Record<ReferenceKind, Map<string, string>>;
  const result: TransferResult = {
    counts: {},
    imported: 0,
    skipped: 0,
    warnings: [],
  };
  const writes: Write[] = [];
  const rulesToWrite: RuleEntity[] = [];
  const existingRules = await rulesApp.handlers['rules-get']();
  const existingReports = await reportsApp.handlers['report/get']();
  const existingTags = await tagsApp.handlers['tags-get']();
  const planned = new Map<Row, string>();
  const idFor = (section: TransferSection, id: string) =>
    uuidv5(`${section}:${id}`, NAMESPACE);
  for (const kind of refKinds) {
    for (const ref of file.references[kind]) {
      const matches = target[kind].filter(
        item =>
          item.id === ref.id ||
          (ref.name &&
            item.name === ref.name &&
            (kind !== 'category' || item.group === ref.group) &&
            !ref.transfer &&
            !item.transfer),
      );
      const exact = matches.find(item => item.id === ref.id);
      if (exact || matches.length === 1) {
        maps[kind].set(ref.id, (exact ?? matches[0]).id);
      }
    }
  }
  // Transfer payees belong to accounts and must resolve to the target account's payee.
  for (const ref of file.references.payee.filter(item => item.transfer)) {
    const account = maps.account.get(ref.transfer!);
    const matches = target.payee.filter(
      item => item.transfer === account && account,
    );
    if (matches.length === 1) maps.payee.set(ref.id, matches[0].id);
  }
  function skip(section: TransferSection, label: string) {
    result.skipped++;
    if (result.warnings.length < 50) {
      result.warnings.push(`${section}: kept existing ${label}.`);
    }
  }
  for (const section of selected) {
    const rows = file.sections[section] ?? [];
    result.counts[section] = rows.length;
    for (const row of rows) {
      const originalId = string(row.id, 'ID');
      const id = idFor(section, originalId);
      const name =
        section === 'rules'
          ? originalId
          : string(
              row[section === 'tags' ? 'tag' : 'name'],
              `${section} name`,
              section === 'schedules',
            );
      const existing =
        section === 'payees'
          ? target.payee.find(
              item => item.id === id || (!item.transfer && item.name === name),
            )
          : section === 'schedules'
            ? target.schedule.find(
                item =>
                  item.id === originalId ||
                  item.id === id ||
                  (name && item.name === name),
              )
            : section === 'tags'
              ? existingTags.find(
                  item =>
                    item.id === originalId ||
                    item.id === id ||
                    item.tag === name,
                )
              : section === 'reports'
                ? existingReports.find(
                    item =>
                      item.id === originalId ||
                      item.id === id ||
                      item.name === name,
                  )
                : existingRules.find(
                    item => item.id === originalId || item.id === id,
                  );
      if (existing) {
        if (section === 'payees' || section === 'schedules') {
          maps[section === 'payees' ? 'payee' : 'schedule'].set(
            originalId,
            existing.id,
          );
        }
        skip(section, name || originalId);
        continue;
      }
      if (section === 'payees' || section === 'schedules') {
        maps[section === 'payees' ? 'payee' : 'schedule'].set(originalId, id);
      }
      planned.set(row, id);
    }
  }
  function resolve(kind: ReferenceKind, value: unknown): unknown {
    if (value === null || value === '') return value;
    if (Array.isArray(value)) return value.map(item => resolve(kind, item));
    const original = string(value, `${kind} reference`);
    const id = maps[kind].get(original);
    if (!id) {
      throw new Error(
        `Unresolved ${kind} reference. Create the matching named item in this budget, include its section, or deselect the affected section.`,
      );
    }
    return id;
  }
  function remap(value: unknown, action = false): Row {
    const item = { ...object(value, 'Rule condition or action') };
    const op = string(item.op, 'Operation');
    if (item.queryFilter || item.field === 'saved') {
      throw new Error(
        'Saved filters and query filters require a full-budget backup.',
      );
    }
    if (item.options) {
      const options = object(item.options, 'Options');
      if (options.formula || options.template) {
        throw new Error(
          'Formula and template rules require a full-budget backup to preserve their references.',
        );
      }
    }
    if (op === 'link-schedule') {
      item.value = resolve('schedule', item.value);
    } else if (
      refKinds.includes(item.field as ReferenceKind) &&
      (action || ['is', 'isNot', 'oneOf', 'notOneOf'].includes(op))
    ) {
      item.value = resolve(item.field as ReferenceKind, item.value);
    }
    return item;
  }
  async function rule(value: unknown, id: string): Promise<RuleEntity> {
    const source = object(value, 'Rule');
    const candidate = {
      id,
      stage: source.stage,
      conditionsOp: source.conditionsOp,
      conditions: list(source.conditions, 'Conditions').map(value =>
        remap(value),
      ),
      actions: list(source.actions, 'Actions').map(value => remap(value, true)),
    };
    ruleModel.validate(candidate);
    const typed = candidate as RuleEntity;
    if ((await rulesApp.handlers['rule-validate'](typed)).error) {
      throw new Error(
        'A rule has invalid conditions or actions. Nothing was imported.',
      );
    }
    return typed;
  }
  for (const section of selected) {
    const names = new Set<string>();
    for (const row of file.sections[section] ?? []) {
      const id = planned.get(row);
      if (!id) continue;
      const name =
        section === 'rules'
          ? id
          : string(
              row[section === 'tags' ? 'tag' : 'name'],
              'Name',
              section === 'schedules',
            );
      if (name && names.has(name)) {
        throw new Error(`Duplicate ${section} name in this file.`);
      }
      names.add(name);
      if (section === 'payees') {
        writes.push({
          table: 'payees',
          row: {
            id,
            name,
            favorite: boolean(row.favorite, 'Favorite') ? 1 : 0,
            learn_categories: boolean(row.learn_categories, 'Learn categories')
              ? 1
              : 0,
            tombstone: 0,
          },
        });
        writes.push({ table: 'payee_mapping', row: { id, targetId: id } });
      } else if (section === 'tags') {
        if (!/^[^#\s]+$/.test(name)) {
          throw new Error('Tag names cannot contain spaces or #.');
        }
        const color = row.color == null ? null : string(row.color, 'Tag color');
        if (color && !/^#[0-9a-f]{3,8}$/i.test(color)) {
          throw new Error('Invalid tag color.');
        }
        writes.push({
          table: 'tags',
          row: {
            id,
            tag: name,
            color,
            description:
              row.description == null
                ? null
                : string(row.description, 'Description', true),
            hidden: boolean(row.hidden, 'Hidden') ? 1 : 0,
            tombstone: 0,
          },
        });
      } else if (section === 'rules') {
        rulesToWrite.push(await rule(row, id));
      } else if (section === 'schedules') {
        const ruleId = uuidv5(`schedule-rule:${id}`, NAMESPACE);
        const importedRule = await rule(row.rule, ruleId);
        if (
          !importedRule.actions.some(
            action => action.op === 'link-schedule' && action.value === id,
          )
        ) {
          throw new Error('The schedule rule must link to its own schedule.');
        }
        const date = importedRule.conditions.find(
          condition => condition.field === 'date',
        );
        if (!date || !getNextDate(date)) {
          if (!boolean(row.completed, 'Completed')) {
            throw new Error(
              'Schedule recurrence must have a valid future occurrence.',
            );
          }
        }
        const nextDate =
          row.next_date == null ? null : string(row.next_date, 'Next date');
        if (nextDate && !isValidYearMonthDay(nextDate)) {
          throw new Error('Invalid schedule date.');
        }
        rulesToWrite.push(importedRule);
        writes.push({
          table: 'schedules',
          row: {
            id,
            name: name || null,
            rule: ruleId,
            completed: boolean(row.completed, 'Completed') ? 1 : 0,
            posts_transaction: 0,
            tombstone: 0,
          },
        });
        const dateValue = nextDate
          ? Number(nextDate.replaceAll('-', ''))
          : null;
        writes.push({
          table: 'schedules_next_date',
          row: {
            id: uuidv5(`next-date:${id}`, NAMESPACE),
            schedule_id: id,
            local_next_date: dateValue,
            base_next_date: dateValue,
            local_next_date_ts: Date.now(),
            base_next_date_ts: Date.now(),
          },
        });
        if (row.posts_transaction) {
          result.warnings.push(
            `Schedule ${String(name || row.id)}: automatic posting will be off until you enable it after import.`,
          );
        }
      } else {
        const allowedStrings = [
          'startDate',
          'endDate',
          'dateRange',
          'mode',
          'groupBy',
          'interval',
          'balanceType',
          'graphType',
        ];
        const report: Row = { id, name, conditionsOp: row.conditionsOp };
        for (const key of allowedStrings) {
          report[key] = string(row[key], key, true);
        }
        for (const key of [
          'isDateStatic',
          'showEmpty',
          'showOffBudget',
          'showHiddenCategories',
          'includeCurrentInterval',
          'showUncategorized',
          'trimIntervals',
          'showTrendLines',
        ]) {
          report[key] = boolean(row[key], key);
        }
        if (
          row.sortBy !== undefined &&
          !['asc', 'desc', 'name', 'budget'].includes(String(row.sortBy))
        ) {
          throw new Error('Invalid report sort order.');
        }
        report.sortBy = row.sortBy ?? 'desc';
        report.conditions = list(row.conditions ?? [], 'Report filters').map(
          value => remap(value),
        );
        const typed = report as CustomReportEntity;
        reportModel.validate(typed);
        const validation = await rulesApp.handlers['rule-validate']({
          conditions: typed.conditions ?? [],
          actions: [],
        });
        if (validation.error) throw new Error('Invalid report filters.');
        writes.push({
          table: 'custom_reports',
          row: reportModel.fromJS(typed),
        });
      }
      result.imported++;
    }
  }
  if (args.mode === 'apply') {
    await batchMessages(async () => {
      for (const item of rulesToWrite) await insertRule(item);
      for (const write of writes) {
        if (
          ['payee_mapping', 'tags', 'schedules_next_date'].includes(write.table)
        ) {
          await db.insert(write.table, write.row);
        } else {
          await db.insertWithSchema(write.table, write.row);
        }
      }
    });
  }
  return result;
}

export type DataTransferHandlers = {
  'data-transfer-export': typeof exportData;
  'data-transfer-import': typeof importData;
};
export const app = createApp<DataTransferHandlers>();
app.method('data-transfer-export', exportData);
app.method('data-transfer-import', mutator(undoable(importData)));
