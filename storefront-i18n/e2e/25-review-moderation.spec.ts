import { expect, test, type Page } from '@playwright/test';
import { e2eSecrets } from '../playwright.config';
import { deleteReviewsByName } from './fixtures/db';

const ADMIN_PASSWORD = e2eSecrets.adminPassword;
const PRODUCT_PATH = '/ro/mobilier/oslo-nightstand';

async function loginAdminInPage(page: Page) {
  await page.goto('/admin/login');
  await page.getByPlaceholder(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !/\/admin\/login$/.test(url.pathname), { timeout: 5000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Review moderation — submit, queue, approve, publish', () => {
  const reviewerName = `E2E Moderation ${Date.now()}`;
  const reviewText = 'Recenzie de test pentru fluxul complet de moderare end-to-end.';

  test.afterAll(async () => {
    await deleteReviewsByName('oslo-nightstand', reviewerName);
  });

  test('a fresh submission is pending — invisible on the product page', async ({ page }) => {
    await page.goto(PRODUCT_PATH);
    await page.getByRole('button', { name: 'Adaugă recenzia ta' }).click();
    await page.getByLabel(/numele tău/i).fill(reviewerName);
    await page.getByLabel(/^comentariu$/i).fill(reviewText);
    await page.getByRole('button', { name: /trimite recenzia/i }).click();

    await expect(page.getByText(/va apărea pe site după verificare/i)).toBeVisible();

    await page.getByRole('button', { name: 'Închide', exact: true }).click();
    await expect(page.getByText(reviewerName)).toHaveCount(0);
  });

  test('the pending submission shows up in the admin moderation queue', async ({ page }) => {
    await loginAdminInPage(page);
    await page.goto('/admin/reviews');
    await expect(page.getByText(reviewerName)).toBeVisible();
  });

  test('approving it moves it out of the pending queue and onto the product page', async ({ page }) => {
    await loginAdminInPage(page);
    await page.goto('/admin/reviews');
    const row = page.locator('tr', { hasText: reviewerName });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Approve' }).click();

    // Approving a pending review drops it out of the (default) pending-filtered list.
    await expect(page.getByText(reviewerName)).toHaveCount(0);

    await page.goto('/admin/reviews?status=approved');
    await expect(page.getByText(reviewerName)).toBeVisible();

    await page.goto(PRODUCT_PATH);
    await expect(page.getByText(reviewerName).first()).toBeVisible();
    await expect(page.getByText(reviewText).first()).toBeVisible();
  });
});
