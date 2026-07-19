/**
 * Regression spec: Revolut Pay / Apple Pay / Google Pay wallet buttons must
 * actually mount on the checkout payment step once shipping is valid.
 *
 * Root cause this guards against: `e2e/fixtures/api-mocks.ts`'s
 * `mockRevolutSDK` faked `window.RevolutCheckout` as a bare function with
 * only `payWithPopup`/`destroy` — missing the static `.payments()` loader
 * method and the `createCardField`/`setDefaultLocale` instance methods that
 * the real `@revolut/checkout` SDK (embed.js) exposes. Every e2e run that
 * reached the payment step silently threw
 * `TypeError: revolutCheckout.payments is not a function` inside
 * RevolutPaymentWidgets' wallet-init effect (caught + console.error'd, never
 * surfaced to the user or asserted on by any test) — so the wallet buttons
 * never rendered in CI, and no test caught it before it shipped to
 * production. See node_modules/@revolut/checkout/esm/loader.js +
 * esm/paymentsLoader.js + types/types.d.ts for the real API surface.
 */
import { expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';
import { TEST_SHIPPING } from './fixtures/checkout-data';
import { mockRevolutCreateOrder, mockRevolutSDK } from './fixtures/api-mocks';

// Runs on `/ro/checkout` — the `ro` market allows both payment methods and
// prices in RON, matching SAMPLE_CART_ITEM's currency (CartProvider's price
// guard would otherwise drop the seeded item).

async function fillShipping(page: import('@playwright/test').Page) {
  await page.fill('#ship-firstName', TEST_SHIPPING.firstName);
  await page.fill('#ship-lastName', TEST_SHIPPING.lastName);
  await page.fill('#ship-phone', TEST_SHIPPING.phone);
  await page.fill('#ship-address', TEST_SHIPPING.address);
  await page.fill('#ship-city', TEST_SHIPPING.city);
  await page.fill('#ship-county', TEST_SHIPPING.county);
  await page.fill('#ship-postalCode', TEST_SHIPPING.postalCode);
}

async function seedStoredEmail(page: import('@playwright/test').Page) {
  await page.addInitScript((email) => {
    try {
      window.localStorage.setItem('sf_user_email', email);
    } catch {
      /* storage denied */
    }
  }, TEST_SHIPPING.email);
}

test.describe('Checkout — Revolut wallets mount on the payment step (regression)', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    await mockRevolutCreateOrder(page);
    await mockRevolutSDK(page);
    await seedStoredEmail(page);
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro/checkout');
  });

  test('Revolut Pay and Apple/Google Pay widgets render with no SDK init error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    // Card is the default payment method — the wallet-init effect fires
    // automatically as soon as the payment step mounts, no extra click.
    await expect(page.getByTestId('checkout-pay-method-card')).toBeVisible();

    const revolutPaySlot = page.getByTestId('wallet-revolut-pay');
    const paymentRequestSlot = page.getByTestId('wallet-payment-request');
    await expect(revolutPaySlot).toBeVisible();
    await expect(paymentRequestSlot).toBeVisible();

    // The slots must actually contain a mounted widget, not just an empty
    // container — an init failure leaves them present but empty.
    await expect(revolutPaySlot.locator('[data-fake-revolut-pay]')).toBeVisible();
    await expect(paymentRequestSlot.locator('[data-fake-payment-request]')).toBeVisible();

    const sdkErrors = consoleErrors.filter((m) => /Revolut SDK init failed|is not a function/i.test(m));
    expect(sdkErrors, `unexpected SDK init errors:\n${sdkErrors.join('\n')}`).toHaveLength(0);
  });

  test('card field mounts with no init error after the explicit "pay with card" click', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    await page.getByTestId('checkout-pay-card').click();

    await expect(page.locator('[data-fake-card-field]')).toBeVisible();

    const cardErrors = consoleErrors.filter((m) => /Card field init failed|is not a function/i.test(m));
    expect(cardErrors, `unexpected card field init errors:\n${cardErrors.join('\n')}`).toHaveLength(0);
  });
});
