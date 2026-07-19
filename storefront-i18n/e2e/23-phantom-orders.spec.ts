/**
 * Regression spec for ISSUES.md #14: phantom orders.
 *
 * Pre-fix behavior:
 *   - Visiting /checkout's payment step auto-POSTed to
 *     /api/payments/revolut/create-order, minting a `pending_payment` order
 *     for every customer who reached step 3 — including those who paid
 *     ramburs or abandoned. Combined with /api/order also creating a fresh
 *     doc, ramburs-after-card-prep produced two rows in Mongo.
 *
 * Post-fix invariants this spec asserts:
 *   1. Reaching the payment step does NOT POST to create-order.
 *   2. The Revolut session is created only after the explicit
 *      "Plătește cu cardul" click.
 *   3. Switching from card to ramburs does NOT trigger a second card-prep.
 *
 * /api/payments/revolut/create-order is mocked (no Revolut sandbox needed —
 * see e2e/fixtures/api-mocks.ts for that flow).
 */
import { expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';
import { TEST_SHIPPING } from './fixtures/checkout-data';
import { mockExternalApis } from './fixtures/api-mocks';

async function fillShipping(page: import('@playwright/test').Page) {
  await page.fill('#ship-firstName', TEST_SHIPPING.firstName);
  await page.fill('#ship-lastName', TEST_SHIPPING.lastName);
  await page.fill('#ship-phone', TEST_SHIPPING.phone);
  await page.fill('#ship-address', TEST_SHIPPING.address);
  await page.fill('#ship-city', TEST_SHIPPING.city);
  await page.fill('#ship-county', TEST_SHIPPING.county);
  await page.fill('#ship-postalCode', TEST_SHIPPING.postalCode);
}

test.describe('Phantom orders regression (#14)', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    await mockExternalApis(page);
    // Seed the captured email so the wizard skips the email-only step.
    await page.addInitScript((email) => {
      try {
        window.localStorage.setItem('sf_user_email', email);
      } catch {
        /* storage denied */
      }
    }, TEST_SHIPPING.email);
    await seedCart(page, [SAMPLE_CART_ITEM]);

    // Mock /api/order so the ramburs path doesn't depend on Resend.
    await page.route('**/api/order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 'PHANTOM1',
          success: true,
          shippingCost: 0,
          totalPrice: 1599,
        }),
      });
    });

    await page.goto('/ro/checkout');
  });

  test('reaching payment step does not auto-create a Revolut order', async ({ page }) => {
    const createOrderRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/payments/revolut/create-order')) {
        createOrderRequests.push(req.url());
      }
    });

    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    await expect(page.getByText(/alege metoda de plată/i)).toBeVisible();

    // Card is the default selected method; wait for the widget to fully
    // render its explicit "Plătește cu cardul" CTA — the exact state the old
    // auto-prepare effect used to POST from — then assert it never did.
    await expect(
      page.getByRole('button', { name: /plătește .+ cu cardul/i }),
    ).toBeVisible();
    expect(createOrderRequests).toHaveLength(0);
  });

  test('Revolut order is created only after the explicit Plătește cu cardul click', async ({ page }) => {
    // The prepare CTA only renders when a Revolut public key is wired in
    // (otherwise the widget shows a "not configured" notice). The e2e dev
    // server always supplies a fake key (playwright.config.ts) and the
    // Revolut SDK is stubbed by mockExternalApis, so this runs in CI without
    // any sandbox credentials — the create-order POST is mocked too, so the
    // assertion fires before the stubbed SDK is ever reached.
    const createOrderRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/payments/revolut/create-order') &&
        req.method() === 'POST',
    );

    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    await expect(page.getByText(/alege metoda de plată/i)).toBeVisible();

    // Click the explicit prepare CTA. This is the trigger that mints the
    // pending_payment doc; before #14 this happened automatically on render.
    await page.getByTestId('checkout-pay-card').click();

    const req = await createOrderRequest;
    const body = JSON.parse(req.postData() ?? '{}');
    expect(body.paymentMethod).toBe('card');
    expect(body.shipping.email).toBe(TEST_SHIPPING.email);
  });

  test('switching from card to ramburs does not trigger another card-prep call', async ({ page }) => {
    const createOrderRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/payments/revolut/create-order')) {
        createOrderRequests.push(req.url());
      }
    });

    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    await expect(page.getByText(/alege metoda de plată/i)).toBeVisible();

    // Customer changes their mind: pick ramburs without ever clicking card.
    await page.getByTestId('checkout-pay-method-ramburs').click();
    await page.getByTestId('checkout-confirm-ramburs').click();

    await page.waitForURL(/\/(confirmare|order-confirmation)\//, { timeout: 10_000 });
    expect(createOrderRequests).toHaveLength(0);
  });
});
