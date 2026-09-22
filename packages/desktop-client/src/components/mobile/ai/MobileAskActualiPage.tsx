import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { AskActualiPanel } from '#components/ai/AskActualiPanel';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page } from '#components/Page';

export function MobileAskActualiPage() {
  const { t } = useTranslation();
  return (
    <Page
      header={
        <MobilePageHeader
          title={t('Ask Actuali')}
          leftContent={<MobileBackButton />}
        />
      }
      padding={14}
      style={{ backgroundColor: theme.mobilePageBackground }}
    >
      <View style={{ display: 'block', flexShrink: 0, padding: '14px 0 24px' }}>
        <AskActualiPanel compact />
      </View>
    </Page>
  );
}
