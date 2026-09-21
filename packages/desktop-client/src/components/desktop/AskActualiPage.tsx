import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { AskActualiPanel } from '#components/ai/AskActualiPanel';
import { PageHeader } from '#components/Page';

export function AskActualiPage() {
  const { t } = useTranslation();
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
          maxWidth: 900,
          width: '100%',
          alignSelf: 'center',
          padding: '30px 34px 46px',
          gap: 8,
        }}
      >
        <PageHeader title={t('Ask Actuali')} style={{ marginLeft: 0 }} />
        <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
          <Trans>Private, explainable help for your money decisions.</Trans>
        </Text>
        <View style={{ marginTop: 18 }}>
          <AskActualiPanel />
        </View>
      </View>
    </View>
  );
}
