import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { AskActualiPanel } from '#components/ai/AskActualiPanel';

export function AskActualiPage() {
  const { t } = useTranslation();
  return (
    <View
      role="main"
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
          display: 'block',
          flex: '0 0 auto',
          minHeight: 'max-content',
        }}
      >
        <h1 style={{ fontSize: 25, fontWeight: 600, margin: '0 0 6px' }}>
          {t('Ask Actuali')}
        </h1>
        <Text style={{ ...styles.smallText, color: theme.pageTextLight }}>
          <Trans>Understand your budget with a model you choose.</Trans>
        </Text>
        <View style={{ marginTop: 18 }}>
          <AskActualiPanel />
        </View>
      </View>
    </View>
  );
}
