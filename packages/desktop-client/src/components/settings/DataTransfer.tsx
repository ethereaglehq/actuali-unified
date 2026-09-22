import React, { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { TransferSection } from '@actual-app/core/types/data-transfer';

import { Checkbox } from '#components/forms';

import { Setting } from './UI';

const SECTIONS: ReadonlyArray<{
  key: TransferSection;
  name: string;
  description: string;
}> = [
  {
    key: 'payees',
    name: 'Payees',
    description: 'Names and payee rules attached to them.',
  },
  {
    key: 'rules',
    name: 'Rules',
    description: 'Automatic categorization and transaction rules.',
  },
  { key: 'tags', name: 'Tags', description: 'Reusable transaction tags.' },
  {
    key: 'schedules',
    name: 'Schedules',
    description: 'Scheduled transaction templates and recurrence.',
  },
  {
    key: 'reports',
    name: 'Reports',
    description: 'Saved report and dashboard definitions.',
  },
];

const MAX_TRANSFER_FILE_BYTES = 10 * 1024 * 1024;
type Selection = Record<TransferSection, boolean>;
type Preview = {
  fileName: string;
  fileSize: number;
  payload: unknown;
  counts: Partial<Record<TransferSection, number>>;
  imported: number;
  skipped: number;
  warnings: string[];
};
type Status = { kind: 'idle' | 'busy' | 'success' | 'error'; message?: string };

function allSelected(): Selection {
  return {
    payees: true,
    rules: true,
    tags: true,
    schedules: true,
    reports: true,
  };
}

function selectedKeys(selection: Selection) {
  return SECTIONS.filter(section => selection[section.key]).map(
    section => section.key,
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function FilePreview({ preview }: { preview: Preview }) {
  return (
    <View
      aria-live="polite"
      style={{
        gap: 8,
        padding: 12,
        borderRadius: 6,
        border: `1px solid ${theme.pillBorderDark}`,
        backgroundColor: theme.pageBackground,
        flexShrink: 0,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {preview.fileName}
        </Text>
        <Text style={{ color: theme.pageTextLight, flexShrink: 0 }}>
          {formatBytes(preview.fileSize)}
        </Text>
      </View>
      <Text style={{ color: theme.pageTextLight }}>
        <Trans>
          Nothing has changed. Review this preview before importing.
        </Trans>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
        {SECTIONS.filter(
          section => preview.counts[section.key] !== undefined,
        ).map(section => (
          <Text
            key={section.key}
            style={{
              padding: '3px 7px',
              borderRadius: 99,
              backgroundColor: theme.pillBackground,
            }}
          >
            <Trans>{section.name}</Trans>: {preview.counts[section.key]}
          </Text>
        ))}
      </View>
      <Text style={{ color: theme.pageTextLight }}>
        <Trans>
          {preview.imported} items ready to add; {preview.skipped} will be
          skipped.
        </Trans>
      </Text>
      {preview.warnings.map(warning => (
        <Text key={warning} style={{ color: theme.warningText }}>
          {warning}
        </Text>
      ))}
    </View>
  );
}

export function DataTransfer() {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>(allSelected);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const requestPreview = async (
    payload: unknown,
    fileName: string,
    fileSize: number,
    nextSelection: Selection,
  ) => {
    const requestId = ++requestIdRef.current;
    setStatus({ kind: 'busy', message: 'Checking import…' });
    try {
      const result = await send('data-transfer-import', {
        mode: 'preview',
        sections: selectedKeys(nextSelection),
        payload,
      });
      if (requestId !== requestIdRef.current) return;
      setPreview({
        fileName,
        fileSize,
        payload,
        counts: result.counts,
        imported: result.imported,
        skipped: result.skipped,
        warnings: result.warnings,
      });
      setStatus({ kind: 'idle' });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setPreview(null);
      setStatus({
        kind: 'error',
        message: errorMessage(error, 'This file could not be previewed.'),
      });
    }
  };

  const updateSection = (section: TransferSection, checked: boolean) => {
    const nextSelection = { ...selection, [section]: checked };
    setSelection(nextSelection);
    if (preview) {
      void requestPreview(
        preview.payload,
        preview.fileName,
        preview.fileSize,
        nextSelection,
      );
    }
  };

  const onExport = async () => {
    const sections = selectedKeys(selection);
    if (sections.length === 0) {
      setStatus({
        kind: 'error',
        message: 'Select at least one section to export.',
      });
      return;
    }
    setStatus({ kind: 'busy', message: 'Preparing your export…' });
    try {
      const result = await send('data-transfer-export', { sections });
      await window.Actual.saveFile(
        result.contents,
        result.filename,
        'Export selected data',
      );
      setStatus({
        kind: 'success',
        message: `Exported ${sections.length} sections.`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: errorMessage(
          error,
          'Export failed. Your budget was not changed.',
        ),
      });
    }
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setPreview(null);
    setStatus({ kind: 'idle' });
    if (!file) return;
    if (file.size > MAX_TRANSFER_FILE_BYTES) {
      setStatus({
        kind: 'error',
        message: `Files must be smaller than ${formatBytes(MAX_TRANSFER_FILE_BYTES)}.`,
      });
      return;
    }
    try {
      await requestPreview(
        JSON.parse(await file.text()) as unknown,
        file.name,
        file.size,
        selection,
      );
    } catch (error) {
      setStatus({
        kind: 'error',
        message: errorMessage(error, 'This file is not valid JSON.'),
      });
    }
  };

  const onImport = async () => {
    if (!preview || preview.imported === 0) return;
    const requestId = ++requestIdRef.current;
    setStatus({ kind: 'busy', message: 'Applying reviewed sections…' });
    try {
      const result = await send('data-transfer-import', {
        mode: 'apply',
        sections: selectedKeys(selection),
        payload: preview.payload,
      });
      if (requestId !== requestIdRef.current) return;
      setPreview(null);
      setStatus({
        kind: 'success',
        message: `Imported ${result.imported} items${result.skipped ? `; skipped ${result.skipped}.` : '.'}`,
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setStatus({
        kind: 'error',
        message: errorMessage(error, 'Import failed. No data was changed.'),
      });
    }
  };

  return (
    <Setting
      style={{ flexShrink: 0 }}
      primaryAction={
        <View style={{ gap: 10, width: '100%', flexShrink: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button onPress={onExport} isDisabled={status.kind === 'busy'}>
              <Trans>Export selected</Trans>
            </Button>
            <Button
              onPress={() => fileInputRef.current?.click()}
              isDisabled={status.kind === 'busy'}
            >
              <Trans>Choose import file</Trans>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={onFileSelected}
              style={{ display: 'none' }}
              aria-label={t('Choose a JSON transfer file')}
            />
          </View>
          {preview ? (
            <>
              <FilePreview preview={preview} />
              <Button
                variant="primary"
                onPress={onImport}
                isDisabled={status.kind === 'busy' || preview.imported === 0}
              >
                <Trans>Import reviewed sections</Trans>
              </Button>
            </>
          ) : null}
          {status.kind !== 'idle' ? (
            <Text
              role={status.kind === 'error' ? 'alert' : 'status'}
              style={{
                color:
                  status.kind === 'error'
                    ? theme.errorText
                    : status.kind === 'success'
                      ? theme.noticeText
                      : theme.pageTextLight,
              }}
            >
              {status.message}
            </Text>
          ) : null}
        </View>
      }
    >
      <Text>
        <strong>
          <Trans>Selective import and export</Trans>
        </strong>{' '}
        <Trans>
          Move payees, rules, tags, schedules, and saved reports between budgets
          without replacing the rest of your file. Files are JSON and can be
          reviewed before anything is written.
        </Trans>
      </Text>
      <View style={{ gap: 8, flexShrink: 0 }}>
        <Text style={{ fontWeight: 500 }}>
          <Trans>Include in transfer</Trans>
        </Text>
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 8,
            width: '100%',
          }}
        >
          {SECTIONS.map(section => (
            <label
              key={section.key}
              htmlFor={`data-transfer-${section.key}`}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: 9,
                borderRadius: 5,
                border: `1px solid ${theme.pillBorderDark}`,
                cursor: 'pointer',
              }}
            >
              <Checkbox
                id={`data-transfer-${section.key}`}
                checked={selection[section.key]}
                onChange={event =>
                  updateSection(section.key, event.currentTarget.checked)
                }
              />
              <span>
                <Text style={{ fontWeight: 500 }}>
                  <Trans>{section.name}</Trans>
                </Text>
                <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
                  <Trans>{section.description}</Trans>
                </Text>
              </span>
            </label>
          ))}
        </View>
      </View>
      <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
        <Trans>
          Choosing a file never changes your budget. Existing IDs and invalid
          entries are reported as skipped; nothing is silently overwritten.
        </Trans>
      </Text>
    </Setting>
  );
}
