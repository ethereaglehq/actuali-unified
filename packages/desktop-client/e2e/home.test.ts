import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';

test.describe('Home surfaces', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);
    await page.goto('/');
    await configurationPage.startFresh();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('desktop home links to Ask Actuali and transaction capture', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/home');

    await expect(page.getByText('Recent activity')).toBeVisible();
    await page.getByRole('button', { name: 'Ask Actuali' }).click();
    await expect(page).toHaveURL(/\/ask$/);
    await expect(page.getByText('Connect your AI through MCP')).toBeVisible();

    await page.goBack();
    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test('mobile home keeps quick actions reachable', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');

    await expect(page.getByText('Recent activity')).toBeVisible();
    await page.getByRole('button', { name: 'Ask Actuali' }).click();
    await expect(page).toHaveURL(/\/ask$/);
    await expect(
      page.getByRole('heading', { name: 'Ask Actuali' }),
    ).toBeVisible();
  });
});
