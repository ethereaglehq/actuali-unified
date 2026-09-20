import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgAdd,
  SvgArrowThinRight,
  SvgReports,
} from '@actual-app/components/icons/v1';
import { SvgRefresh } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { PageHeader } from '#components/Page';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useHomeData } from '../home/useHomeData';

const panelClass = css({
  backgroundColor: theme.tableBackground,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 12,
});

export function DesktopHomePage() {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const {
    activeAccounts,
    allBalance,
    onBudgetBalance,
    offBudgetBalance,
    recentTransactions,
    payees,
    isLoading,
    syncStatus,
  } = useHomeData();
  const payeeNames = new Map(payees.map(payee => [payee.id, payee.name]));

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
              {syncStatus === 'online'
                ? t('Everything is up to date across your devices.')
                : t('Working from your local copy.')}
            </Text>
          </View>
          <Button
            variant="primary"
            onPress={() => void navigate('/transactions/new')}
            style={{ minHeight: 40, gap: 8 }}
          >
            <SvgAdd width={18} height={18} />
            <Text style={{ fontWeight: 700 }}>{t('Add transaction')}</Text>
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
                {t('Total across active accounts')}
              </Text>
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
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  backgroundColor:
                    syncStatus === 'online'
                      ? theme.numberPositive
                      : theme.warningText,
                }}
              />
              <Text style={{ color: theme.mobileHeaderText, fontWeight: 600 }}>
                {syncStatus === 'online'
                  ? t('Synced')
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
                {t('Recent activity')}
              </Text>
              <Button
                variant="bare"
                onPress={() => void navigate('/accounts')}
                style={{ minHeight: 32 }}
              >
                <Text style={{ color: theme.pageTextLink, fontWeight: 600 }}>
                  {t('View all')}
                </Text>
                <SvgArrowThinRight
                  width={15}
                  height={15}
                  style={{ marginLeft: 4 }}
                />
              </Button>
            </View>
            {isLoading && <ActivityLoading />}
            {!isLoading && recentTransactions.length === 0 && (
              <Text style={{ padding: 24, color: theme.pageTextLight }}>
                {t('No transactions yet.')}
              </Text>
            )}
            {!isLoading &&
              recentTransactions.slice(0, 7).map((transaction, index) => (
                <Button
                  key={transaction.id}
                  variant="bare"
                  onPress={() =>
                    void navigate(`/transactions/${transaction.id}`)
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
                      {transaction.date} ·{' '}
                      {activeAccounts.find(
                        account => account.id === transaction.account,
                      )?.name || t('Account')}
                    </Text>
                  </View>
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
                </Button>
              ))}
          </View>

          <View style={{ width: 340, gap: 14 }}>
            <View className={panelClass} style={{ padding: 18 }}>
              <Text style={{ fontSize: 17, fontWeight: 700 }}>
                {t('Keep moving')}
              </Text>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.pageTextLight,
                  marginTop: 5,
                }}
              >
                {t('Shortcuts for the work you do most.')}
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
                <Text style={{ fontWeight: 700 }}>{t('Sync health')}</Text>
              </View>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.pageTextLight,
                  marginTop: 7,
                }}
              >
                {syncStatus === 'online'
                  ? t('Local changes are syncing automatically.')
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
                  {t('Manage sync settings')}
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
}: {
  label: string;
  value: number | null;
  format: (value: unknown, type?: 'financial') => string;
}) {
  return (
    <View className={panelClass} style={{ flex: 1, padding: 17 }}>
      <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
        {label}
      </Text>
      <Text
        style={{ ...styles.tnum, fontSize: 19, fontWeight: 700, marginTop: 7 }}
      >
        {format(
          value,
          typeof value === 'number' && label !== 'Active accounts'
            ? 'financial'
            : undefined,
        )}
      </Text>
    </View>
  );
}

function DesktopAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Button
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

function ActivityLoading() {
  const { t } = useTranslation();
  return (
    <Text style={{ padding: 24, color: theme.pageTextLight }}>
      {t('Loading…')}
    </Text>
  );
}
