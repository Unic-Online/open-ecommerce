import { expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';
import { TEST_SHIPPING } from './fixtures/checkout-data';

test.describe('Checkout — email-first step (abandoned-cart capture)', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    await seedCart(page, [SAMPLE_CART_ITEM]);
  });

  test('email step is the default first step when no email is stored', async ({ page }) => {
    await page.goto('/ro/checkout');
    // Email-only form is rendered.
    await expect(page.locator('#email-only')).toBeVisible();
    // Shipping form is NOT yet rendered.
    await expect(page.locator('#ship-firstName')).toHaveCount(0);
  });

  test('submitting valid email POSTs to /api/cart/sync and advances to shipping', async ({
    page,
  }) => {
    await page.goto('/ro/checkout');

    // The abandoned-cart plugin also syncs on page load/activity; on a slow
    // server that background POST (no email yet) can win a bare URL match
    // and fail the body.email assert below. Only accept the sync carrying
    // the email this test submits.
    const syncRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/cart/sync') &&
        req.method() === 'POST' &&
        (req.postData() ?? '').includes(TEST_SHIPPING.email),
    );

    // Beat the Next.js hydration race on a cold server: a fill/click that
    // lands before React attaches its handlers silently no-ops (the
    // controlled input resets, or the submit handler isn't wired yet), so the
    // email sync never fires and the wait above times out. Retry the
    // fill+submit until the step actually advances — proof the handler ran.
    await expect(async () => {
      if (await page.locator('#ship-firstName').isVisible()) return;
      await page.fill('#email-only', TEST_SHIPPING.email);
      await page.getByTestId('checkout-email-continue').click();
      await expect(page.locator('#ship-firstName')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 10_000 });

    const req = await syncRequest;
    const body = JSON.parse(req.postData() ?? '{}');
    expect(body.email).toBe(TEST_SHIPPING.email);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);

    // Email step is replaced by a summary; shipping form is now visible.
    await expect(page.locator('#ship-firstName')).toBeVisible();
    await expect(page.getByText(TEST_SHIPPING.email).first()).toBeVisible();
  });

  test('email is stored in localStorage so a refresh skips the email step', async ({ page }) => {
    await page.goto('/ro/checkout');
    await page.fill('#email-only', TEST_SHIPPING.email);
    await page.getByTestId('checkout-email-continue').click();
    await expect(page.locator('#ship-firstName')).toBeVisible();

    // The form has captured the email and the shipping step is now active.
    // Reload the page — we should land on shipping (not on the email step).
    await page.reload();
    await expect(page.locator('#ship-firstName')).toBeVisible();
    await expect(page.locator('#email-only')).toHaveCount(0);
  });

  test('invalid email shows an inline error and does not advance', async ({ page }) => {
    await page.goto('/ro/checkout');
    await page.fill('#email-only', 'not-an-email');
    await page.getByTestId('checkout-email-continue').click();

    await expect(page.getByText(/email validă/i)).toBeVisible();
    await expect(page.locator('#ship-firstName')).toHaveCount(0);
  });

  test('"Modifică" on the email summary returns to the email step', async ({ page }) => {
    await page.goto('/ro/checkout');
    await page.fill('#email-only', TEST_SHIPPING.email);
    await page.getByTestId('checkout-email-continue').click();
    await expect(page.locator('#ship-firstName')).toBeVisible();

    await page.getByTestId('checkout-email-edit').click();
    await expect(page.locator('#email-only')).toBeVisible();
    await expect(page.locator('#email-only')).toHaveValue(TEST_SHIPPING.email);
  });
});
