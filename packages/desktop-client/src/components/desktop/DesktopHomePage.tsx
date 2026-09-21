import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgAdd,
  SvgArrowThinRight,
  SvgChatBubbleDots,
  SvgRefresh,
  SvgReports,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { formatHomeDate, useHomeData } from '#components/home/useHomeData';
import { PageHeader } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';

const panelClass = css({
  backgroundColor: theme.tableBackground,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 12,
});

const actionClass = css({
  transition: 'transform 160ms ease, box-shadow 160ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: styles.cardShadow,
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:hover, &:active': {
      transform: 'none',
    },
  },
});

export function DesktopHomePage() {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const navigate = useNavigate();
  const {
    accounts,
    activeAccounts,
    allBalance,
    onBudgetBalance,
    offBudgetBalance,
    recentTransactions,
    payees,
    isLoading,
    isError,
    retry,
    syncStatus,
    isSyncing,
    syncState,
  } = useHomeData();
  const payeeNames = new Map(payees.map(payee => [payee.id, payee.name]));
  const accountNames = new Map(
    accounts.map(account => [account.id, account.name]),
  );

  return (
    <View
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: theme.pageBackground,
      }}
    >
      <View
        style={{
          maxWidth: 1280,
          width: '100%',
          alignSelf: 'center',
          padding: '30px 34px 46px',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
          }}
        >
          <View>
            <PageHeader title={t('Home')} style={{ marginLeft: 0 }} />
            <Text
              style={{
                ...styles.smallText,
                color: theme.pageTextLight,
                marginTop: 6,
              }}
            >
              {isSyncing
                ? t('Syncing your latest changes…')
                : syncState === 'error'
                  ? t('Sync needs attention. Your local changes are safe.')
                  : syncState === 'disabled'
                    ? t('Sync is disabled. Changes stay on this device.')
                    : syncStatus === 'online'
                      ? t(
                          'Connected to sync server. Changes sync when available.',
                        )
                      : t('Working from your local copy.')}
            </Text>
          </View>
          <Button
            variant="primary"
            onPress={() =>
              void navigate('/accounts', {
                state: { openAddTransaction: true },
              })
            }
            style={{ minHeight: 40, gap: 8 }}
          >
            <SvgAdd width={18} height={18} />
            <Text style={{ fontWeight: 700 }}>
              <Trans>Add transaction</Trans>
            </Text>
          </Button>
        </View>

        <View
          className={panelClass}
          style={{
            padding: 24,
            backgroundColor: theme.mobileHeaderBackground,
            borderColor: theme.mobileHeaderBackground,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <View>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.mobileHeaderTextSubdued,
                }}
              >
                <Trans>Total across active accounts</Trans>
              </Text>
              <PrivacyFilter includeNarrow>
                <Text
                  style={{
                    ...styles.tnum,
                    color: theme.mobileHeaderText,
                    fontSize: 38,
                    fontWeight: 700,
                    marginTop: 5,
                  }}
                >
                  {allBalance == null ? '—' : format(allBalance, 'financial')}
                </Text>
              </PrivacyFilter>
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  backgroundColor:
                    syncStatus === 'online' &&
                    syncState !== 'disabled' &&
                    syncState !== 'local' &&
                    syncState !== 'error'
                      ? theme.numberPositive
                      : theme.warningText,
                }}
              />
              <Text style={{ color: theme.mobileHeaderText, fontWeight: 600 }}>
                {isSyncing
                  ? t('Syncing')
                  : syncState === 'error'
                    ? t('Needs attention')
                    : syncState === 'disabled'
                      ? t('Sync disabled')
                      : syncStatus === 'online'
                        ? t('Connected')
                        : syncStatus === 'offline'
                          ? t('Offline')
                          : t('Local only')}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
          <BalancePanel
            label={t('On budget')}
            value={onBudgetBalance}
            format={format}
          />
          <BalancePanel
            label={t('Off budget')}
            value={offBudgetBalance}
            format={format}
          />
          <BalancePanel
            label={t('Active accounts')}
            value={activeAccounts.length}
            format={value => String(value ?? 0)}
            isCurrency={false}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: 16,
            marginTop: 24,
            alignItems: 'flex-start',
          }}
        >
          <View className={panelClass} style={{ flex: 1, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '17px 18px',
                borderBottom: `1px solid ${theme.tableBorder}`,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: 700 }}>
                <Trans>Recent activity</Trans>
              </Text>
              <Button
                variant="bare"
                onPress={() => void navigate('/accounts')}
                style={{ minHeight: 32 }}
              >
                <Text style={{ color: theme.pageTextLink, fontWeight: 600 }}>
                  <Trans>View all</Trans>
                </Text>
                <SvgArrowThinRight
                  width={15}
                  height={15}
                  style={{ marginLeft: 4 }}
                />
              </Button>
            </View>
            {isLoading && <ActivityLoading />}
            {isError && <ActivityError onRetry={retry} />}
            {!isLoading && !isError && recentTransactions.length === 0 && (
              <Text style={{ padding: 24, color: theme.pageTextLight }}>
                <Trans>No transactions yet.</Trans>
              </Text>
            )}
            {!isLoading &&
              !isError &&
              recentTransactions.slice(0, 7).map((transaction, index) => (
                <Button
                  key={transaction.id}
                  variant="bare"
                  onPress={() =>
                    void navigate(
                      transaction.account
                        ? `/accounts/${transaction.account}`
                        : '/accounts',
                    )
                  }
                  style={{
                    width: '100%',
                    minHeight: 62,
                    borderRadius: 0,
                    padding: '10px 18px',
                    borderBottom:
                      index < Math.min(recentTransactions.length, 7) - 1
                        ? `1px solid ${theme.tableBorder}`
                        : undefined,
                  }}
                >
                  <View
                    style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}
                  >
                    <TextOneLine style={{ fontWeight: 600, maxWidth: '100%' }}>
                      {(transaction.payee &&
                        payeeNames.get(transaction.payee)) ||
                        transaction.notes ||
                        t('Uncategorized transaction')}
                    </TextOneLine>
                    <Text
                      style={{
                        ...styles.smallText,
                        color: theme.pageTextLight,
                        marginTop: 2,
                      }}
                    >
                      {formatHomeDate(transaction.date, dateFormat) ||
                        t('Unknown date')}{' '}
                      ·{' '}
                      {(transaction.account &&
                        accountNames.get(transaction.account)) ||
                        t('Account')}
                    </Text>
                  </View>
                  <PrivacyFilter includeNarrow>
                    <Text
                      style={{
                        ...styles.tnum,
                        fontWeight: 600,
                        color:
                          transaction.amount >= 0
                            ? theme.numberPositive
                            : theme.pageText,
                        marginLeft: 16,
                      }}
                    >
                      {format(transaction.amount, 'financial-with-sign')}
                    </Text>
                  </PrivacyFilter>
                </Button>
              ))}
          </View>

          <View style={{ width: 340, gap: 14 }}>
            <View className={panelClass} style={{ padding: 18 }}>
              <Text style={{ fontSize: 17, fontWeight: 700 }}>
                <Trans>Keep moving</Trans>
              </Text>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.pageTextLight,
                  marginTop: 5,
                }}
              >
                <Trans>Shortcuts for the work you do most.</Trans>
              </Text>
              <DesktopAction
                label={t('Plan this month')}
                icon={<SvgReports width={17} height={17} />}
                onPress={() => void navigate('/budget')}
              />
              <DesktopAction
                label={t('Review accounts')}
                icon={<SvgArrowThinRight width={17} height={17} />}
                onPress={() => void navigate('/accounts')}
              />
              <DesktopAction
                label={t('Open reports')}
                icon={<SvgReports width={17} height={17} />}
                onPress={() => void navigate('/reports')}
              />
              <DesktopAction
                label={t('Ask Actuali')}
                icon={<SvgChatBubbleDots width={17} height={17} />}
                onPress={() => void navigate('/ask')}
              />
            </View>
            <View className={panelClass} style={{ padding: 18 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <SvgRefresh
                  width={16}
                  height={16}
                  style={{ color: theme.pageTextLight }}
                />
                <Text style={{ fontWeight: 700 }}>
                  <Trans>Sync health</Trans>
                </Text>
              </View>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.pageTextLight,
                  marginTop: 7,
                }}
              >
                {isSyncing
                  ? t('Syncing your latest changes…')
                  : syncState === 'error'
                    ? t('Sync needs attention. Your local changes are safe.')
                    : syncState === 'disabled'
                      ? t('Sync is disabled. Changes stay on this device.')
                      : syncStatus === 'online'
                        ? t(
                            'Connected to sync server. Changes sync when available.',
                          )
                        : syncStatus === 'offline'
                          ? t('You are offline. Nothing will be lost.')
                          : t('This budget is stored on this device only.')}
              </Text>
              <Button
                variant="bare"
                onPress={() => void navigate('/settings')}
                style={{ padding: 0, minHeight: 34, marginTop: 10 }}
              >
                <Text style={{ color: theme.pageTextLink, fontWeight: 600 }}>
                  <Trans>Manage sync settings</Trans>
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function BalancePanel({
  label,
  value,
  format,
  isCurrency = true,
}: {
  label: string;
  value: number | null;
  format: (value: unknown, type?: 'financial') => string;
  isCurrency?: boolean;
}) {
  return (
    <View className={panelClass} style={{ flex: 1, padding: 17 }}>
      <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
        {label}
      </Text>
      <PrivacyFilter includeNarrow>
        <Text
          style={{
            ...styles.tnum,
            fontSize: 19,
            fontWeight: 700,
            marginTop: 7,
          }}
        >
          {value == null
            ? '—'
            : format(value, isCurrency ? 'financial' : undefined)}
        </Text>
      </PrivacyFilter>
    </View>
  );
}

function DesktopAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Button
      className={actionClass}
      variant="bare"
      onPress={onPress}
      style={{
        width: '100%',
        justifyContent: 'space-between',
        minHeight: 42,
        padding: '4px 0',
        marginTop: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {icon}
        <Text>{label}</Text>
      </View>
      <SvgArrowThinRight
        width={15}
        height={15}
        style={{ color: theme.pageTextLight }}
      />
    </Button>
  );
}

function ActivityError({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <View style={{ padding: 24, gap: 9 }}>
      <Text style={{ color: theme.pageTextLight }}>
        <Trans>We couldn't load your latest activity.</Trans>
      </Text>
      <Button
        variant="bare"
        onPress={() => void onRetry()}
        style={{ padding: 0, minHeight: 34, alignSelf: 'flex-start' }}
      >
        <Text style={{ color: theme.pageTextLink, fontWeight: 600 }}>
          <Trans>Try again</Trans>
        </Text>
      </Button>
    </View>
  );
}

function ActivityLoading() {
  return (
    <Text style={{ padding: 24, color: theme.pageTextLight }}>
      <Trans>Loading…</Trans>
    </Text>
  );
}
