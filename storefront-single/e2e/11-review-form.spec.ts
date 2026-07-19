import { expect, test } from '@playwright/test';
import { clearCartStorage } from './fixtures/cart';
import { deleteReviewsByName } from './fixtures/db';

const PRODUCT = '/furniture/oslo-nightstand';

test.describe('User-submitted reviews — submission is moderated, never immediate', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  test('the "Add a review" button is visible on the product page', async ({ page }) => {
    await page.goto(PRODUCT);
    // ReviewSummary surfaces the canonical "Add a review" CTA
    await expect(
      page.getByRole('button', { name: /add a review/i }),
    ).toBeVisible();
  });

  test('valid submission shows the moderation-pending message, not the review itself', async ({ page }) => {
    const name = `E2E Pending ${Date.now()}`;
    await page.goto(PRODUCT);

    await page.getByRole('button', { name: /add a review/i }).click();

    await page.getByLabel(/your name/i).fill(name);
    await page.getByRole('radio', { name: /4 stars/i }).click();
    await page.getByLabel(/^title/i).fill('Excellent nightstand');
    await page
      .getByLabel(/^comment$/i)
      .fill('Automated test review, enough content to pass validation.');
    await page.getByLabel(/email \(optional\)/i).fill('reviewer@test.example');

    await page.getByRole('button', { name: /submit review/i }).click();

    // The new flow never shows the submitted review inline — it's pending
    // moderation. Only the "thanks, we'll review it" message appears.
    await expect(page.getByText(/will appear on the site after verification/i)).toBeVisible();
    await expect(page.getByText('Excellent nightstand')).toHaveCount(0);

    await deleteReviewsByName('oslo-nightstand', name);
  });

  test('submission with name too short shows an inline error', async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole('button', { name: /add a review/i }).click();

    await page.getByLabel(/your name/i).fill('A');
    await page
      .getByLabel(/^comment$/i)
      .fill('My sample review for validation.');
    await page.getByRole('button', { name: /submit review/i }).click();

    await expect(page.getByText(/enter your name/i)).toBeVisible();
  });

  test('submission with too-short comment shows an inline error', async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole('button', { name: /add a review/i }).click();

    await page.getByLabel(/your name/i).fill('Tester');
    await page.getByLabel(/^comment$/i).fill('short');
    await page.getByRole('button', { name: /submit review/i }).click();

    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
  });
});
