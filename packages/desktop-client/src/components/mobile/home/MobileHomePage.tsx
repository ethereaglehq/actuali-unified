import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgAdd,
  SvgArrowThinRight,
  SvgHome,
  SvgReports,
} from '@actual-app/components/icons/v1';
import { SvgRefresh } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { MobilePageHeader, Page } from '#components/Page';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useHomeData } from '../../home/useHomeData';

const surfaceClass = css({
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 14,
  backgroundColor: theme.tableBackground,
});

function SyncPill({ status }: { status: 'offline' | 'no-server' | 'online' }) {
  const { t } = useTranslation();
  const copy = {
    online: t('Synced across your devices'),
    offline: t('Offline · changes saved locally'),
    'no-server': t('Local-only mode'),
  }[status];
  const color = status === 'online' ? theme.numberPositive : theme.warningText;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: color }}
      />
      <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
        {copy}
      </Text>
    </View>
  );
}

function BalanceTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | null;
  tone?: 'positive' | 'neutral';
}) {
  const format = useFormat();
  return (
    <View style={{ flex: 1, padding: 14, minWidth: 0 }}>
      <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
        {label}
      </Text>
      <Text
        style={{
          ...styles.tnum,
          fontSize: 17,
          fontWeight: 700,
          color: tone === 'positive' ? theme.numberPositive : theme.pageText,
          marginTop: 5,
        }}
      >
        {value == null ? '—' : format(value, 'financial')}
      </Text>
    </View>
  );
}

export function MobileHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
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
  const payeeNames = useMemo(
    () => new Map(payees.map(payee => [payee.id, payee.name])),
    [payees],
  );

  return (
    <Page
      header={
        <MobilePageHeader
          title={t('Home')}
          leftContent={
            <SvgHome width={19} height={19} style={{ marginLeft: 16 }} />
          }
          rightContent={
            <Button
              variant="bare"
              aria-label={t('Add transaction')}
              onPress={() => void navigate('/transactions/new')}
              style={{ marginRight: 8, minWidth: 40, minHeight: 40 }}
            >
              <SvgAdd width={20} height={20} />
            </Button>
          }
        />
      }
      padding={14}
      style={{ backgroundColor: theme.mobilePageBackground }}
    >
      <View style={{ paddingBottom: 24 }}>
        <View
          className={surfaceClass}
          style={{
            padding: 18,
            backgroundColor: theme.mobileHeaderBackground,
            borderColor: theme.mobileHeaderBackground,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.mobileHeaderTextSubdued,
                }}
              >
                {t('Money at a glance')}
              </Text>
              <Text
                style={{
                  ...styles.tnum,
                  color: theme.mobileHeaderText,
                  fontSize: 30,
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {allBalance == null ? '—' : format(allBalance, 'financial')}
              </Text>
              <Text
                style={{
                  ...styles.smallText,
                  color: theme.mobileHeaderTextSubdued,
                  marginTop: 3,
                }}
              >
                {t('{{count}} active accounts', {
                  count: activeAccounts.length,
                })}
              </Text>
            </View>
            <View
              style={{
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <SyncPill status={syncStatus} />
              <Button
                variant="bare"
                onPress={() => void navigate('/accounts')}
                style={{
                  color: theme.mobileHeaderText,
                  minHeight: 36,
                  padding: 0,
                }}
              >
                <Text
                  style={{ color: theme.mobileHeaderText, fontWeight: 600 }}
                >
                  {t('View accounts')}
                </Text>
                <SvgArrowThinRight
                  width={16}
                  height={16}
                  style={{ marginLeft: 5 }}
                />
              </Button>
            </View>
          </View>
        </View>

        <View
          className={surfaceClass}
          style={{ flexDirection: 'row', marginTop: 12, overflow: 'hidden' }}
        >
          <BalanceTile
            label={t('On budget')}
            value={onBudgetBalance}
            tone="positive"
          />
          <View style={{ width: 1, backgroundColor: theme.tableBorder }} />
          <BalanceTile label={t('Off budget')} value={offBudgetBalance} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <QuickAction
            label={t('Add expense')}
            icon={<SvgAdd width={19} height={19} />}
            onPress={() => void navigate('/transactions/new')}
            accent
          />
          <QuickAction
            label={t('Plan budget')}
            icon={<SvgHome width={19} height={19} />}
            onPress={() => void navigate('/budget')}
          />
          <QuickAction
            label={t('See reports')}
            icon={<SvgReports width={19} height={19} />}
            onPress={() => void navigate('/reports')}
          />
        </View>

        <View style={{ marginTop: 24 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 9,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: 700, color: theme.pageText }}
            >
              {t('Recent activity')}
            </Text>
            <Button
              variant="bare"
              onPress={() => void navigate('/accounts')}
              style={{ minHeight: 36 }}
            >
              <Text style={{ color: theme.pageTextLink, fontWeight: 600 }}>
                {t('See all')}
              </Text>
            </Button>
          </View>
          <View className={surfaceClass} style={{ overflow: 'hidden' }}>
            {isLoading && <ActivitySkeleton />}
            {!isLoading && recentTransactions.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.pageTextLight }}>
                  {t('Your latest transactions will appear here.')}
                </Text>
              </View>
            )}
            {!isLoading &&
              recentTransactions.slice(0, 5).map((transaction, index) => {
                const payee = transaction.payee
                  ? payeeNames.get(transaction.payee)
                  : null;
                const label =
                  payee || transaction.notes || t('Uncategorized transaction');
                const account = activeAccounts.find(
                  item => item.id === transaction.account,
                );
                return (
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
                      borderBottom:
                        index < Math.min(recentTransactions.length, 5) - 1
                          ? `1px solid ${theme.tableBorder}`
                          : undefined,
                      padding: '9px 13px',
                    }}
                  >
                    <View
                      style={{ flex: 1, alignItems: 'flex-start', minWidth: 0 }}
                    >
                      <TextOneLine
                        style={{ fontWeight: 600, maxWidth: '100%' }}
                      >
                        {label}
                      </TextOneLine>
                      <Text
                        style={{
                          ...styles.smallText,
                          color: theme.pageTextLight,
                          marginTop: 2,
                        }}
                      >
                        {account?.name || t('Account')} ·{' '}
                        {transaction.date.slice(4, 6)}/
                        {transaction.date.slice(6, 8)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        ...styles.tnum,
                        color:
                          transaction.amount >= 0
                            ? theme.numberPositive
                            : theme.pageText,
                        fontWeight: 600,
                        marginLeft: 10,
                      }}
                    >
                      {format(transaction.amount, 'financial-with-sign')}
                    </Text>
                  </Button>
                );
              })}
          </View>
        </View>

        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <SvgRefresh
            width={17}
            height={17}
            style={{ color: theme.pageTextLight }}
          />
          <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
            {syncStatus === 'online'
              ? t('Changes sync automatically across every device.')
              : t('You can keep working safely while offline.')}
          </Text>
        </View>
      </View>
    </Page>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
  accent = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Button
      onPress={onPress}
      variant={accent ? 'primary' : 'normal'}
      style={{
        flex: 1,
        minHeight: 58,
        padding: 8,
        gap: 5,
        flexDirection: 'column',
      }}
    >
      {icon}
      <Text style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
        {label}
      </Text>
    </Button>
  );
}

function ActivitySkeleton() {
  return (
    <View style={{ padding: 14, gap: 12 }}>
      {[0, 1, 2].map(item => (
        <View
          key={item}
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
        >
          <View
            style={{
              height: 12,
              width: `${42 + item * 12}%`,
              backgroundColor: theme.pageTextLight,
              opacity: 0.28,
              borderRadius: 4,
            }}
          />
          <View
            style={{
              height: 12,
              width: 64,
              backgroundColor: theme.pageTextLight,
              opacity: 0.28,
              borderRadius: 4,
            }}
          />
        </View>
      ))}
    </View>
  );
}
