import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';

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
      <AskActualiPanel compact />
    </Page>
  );
}
