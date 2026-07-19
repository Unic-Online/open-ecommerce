import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { e2eSecrets } from '../playwright.config';
import { clearCartStorage } from './fixtures/cart';
import { mockRevolutSDK } from './fixtures/api-mocks';
import {
  closeTestDb,
  deleteCartAndCoupons,
  seedCart,
  seedCoupon,
} from './fixtures/db';

// HMAC token in the same format the server signs (see recovery-token.ts).
function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function signRecoveryToken(cartId: string, expiresInDays = 7): string {
  const exp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload = base64Url(Buffer.from(JSON.stringify({ cartId, exp })));
  // Mirror the server's context-binding (KIND_RECOVERY in
  // server/recovery-token.ts) so the token verifies with the new scheme.
  const sig = crypto
    .createHmac('sha256', e2eSecrets.hmacSecret)
    .update(`cart-recovery.${payload}`)
    .digest();
  return `${payload}.${base64Url(sig)}`;
}

// RON-priced sample (the `ro` market). The coupon-display surfaces live on the
// RO storefront (`/ro/comanda` + `/ro/checkout`), where the discount copy is
// in Romanian.
const SAMPLE_ITEM = {
  id: 'furniture__oslo-nightstand',
  productType: 'furniture',
  productName: 'Oslo Nightstand',
  quantity: 1,
  image: '/images/oslo-nightstand/1.jpg',
  unitPrice: 749,
  slug: 'oslo-nightstand',
  shortName: 'Oslo Nightstand',
};

const SHIPPING = {
  firstName: 'Ion',
  lastName: 'Popescu',
  phone: '+40712345678',
  address: 'Str. Testare 1',
  city: 'Otopeni',
  county: 'Ilfov',
  postalCode: '012345',
};

// Drive the recovery URL (which validates the coupon server-side and writes
// `sf_applied_coupon` to localStorage) then land on the RO cart page. The
// recovery client routes to the default-locale cart (`/cart`, the `english`
// market) whose price guard drops the RON item, so we re-seed the cart and
// navigate to `/ro/comanda` for the Romanian coupon breakdown.
async function recoverThenComanda(
  page: import('@playwright/test').Page,
  cartId: string,
) {
  await page.goto(`/recover/${signRecoveryToken(cartId)}`);
  await page.waitForURL(/\/(cart|comanda)$/, { timeout: 10_000 });
  // The recovery client routed to the default-locale `/cart` (english market),
  // whose CartProvider drops the RON item from localStorage. Re-seed the cart
  // via an init script so it is present BEFORE the `/ro/comanda` page hydrates
  // (a runtime localStorage write would race the english cart's clearing
  // effect). `sf_applied_coupon` + `sf_user_email`, written by the recovery
  // client, survive the hop and drive the coupon breakdown.
  await page.addInitScript((item) => {
    window.localStorage.setItem('storefront-cart', JSON.stringify([item]));
  }, SAMPLE_ITEM);
  await page.goto('/ro/comanda');
}

// Checkout is a 3-step flow (email → shipping → payment). Step 1 owns the
// only email input (#email-only); the shipping form has no email field.
// When the email is already known (e.g. via coupon recovery setting
// localStorage.sf_user_email), the page skips step 1 and lands on shipping
// directly, so we have to handle both possibilities.
async function fillCheckoutEmailIfNeeded(page: import('@playwright/test').Page, email: string) {
  const emailInput = page.locator('#email-only');
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(email);
    await page.getByTestId('checkout-email-continue').click();
    await page.locator('#ship-firstName').waitFor({ state: 'visible' });
  }
}

async function changeCheckoutEmail(page: import('@playwright/test').Page, newEmail: string) {
  // The shipping step shows a small "Modifică" link next to the email
  // summary that returns the user to step 1 — that's the only way to
  // edit the email mid-checkout since the shipping form has no email
  // field of its own.
  await page.getByTestId('checkout-email-edit').first().click();
  await page.locator('#email-only').fill(newEmail);
  await page.getByTestId('checkout-email-continue').click();
  await page.locator('#ship-firstName').waitFor({ state: 'visible' });
}

async function fillShipping(page: import('@playwright/test').Page, email: string) {
  await fillCheckoutEmailIfNeeded(page, email);
  await page.fill('#ship-firstName', SHIPPING.firstName);
  await page.fill('#ship-lastName', SHIPPING.lastName);
  await page.fill('#ship-phone', SHIPPING.phone);
  await page.fill('#ship-address', SHIPPING.address);
  await page.fill('#ship-city', SHIPPING.city);
  await page.fill('#ship-county', SHIPPING.county);
  await page.fill('#ship-postalCode', SHIPPING.postalCode);
}

test.afterAll(async () => {
  await closeTestDb();
});

test.describe('Recovery coupon display flow', () => {
  // Each test gets a unique cartId so parallel workers don't trample each
  // other in MongoDB. The afterEach hook cleans up the cart + coupon.
  let cartId: string;

  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    // The fake e2e Revolut public key makes the card widget mount its wallet
    // effect once the coupon tests reach the payment step — stub the SDK so
    // it never reaches Revolut's CDN.
    await mockRevolutSDK(page);
    cartId = crypto.randomUUID();
  });

  test.afterEach(async () => {
    await deleteCartAndCoupons(cartId);
  });

  test('happy path: recover with valid coupon shows COD APLICAT row on /comanda', async ({
    page,
  }) => {
    const couponCode = 'SHOP-TEST-A1B2';
    const email = 'happy@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    await recoverThenComanda(page, cartId);

    // Green "Cod aplicat" chip + the coupon code + the coupon's -10% suffix
    await expect(page.getByText(/cod aplicat/i).first()).toBeVisible();
    await expect(page.getByText(couponCode).first()).toBeVisible();
    await expect(page.getByText(/-10%/).first()).toBeVisible();
    // Default welcome-discount row stays visible — both stack
    await expect(
      page.getByText(/reducere de bun venit \(-10%\)/i).first(),
    ).toBeVisible();
  });

  test('expired coupon: recovery succeeds, no COD APLICAT row', async ({ page }) => {
    const couponCode = 'SHOP-EXPI-RED1';
    const email = 'expired@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({
      code: couponCode,
      cartId,
      email,
      validUntil: new Date(Date.now() - 60_000),
    });

    await recoverThenComanda(page, cartId);

    // Cart still restores
    await expect(page.getByRole('heading', { name: /coșul meu/i })).toBeVisible();
    // ...but no coupon chip
    await expect(page.getByText(/cod aplicat/i)).toHaveCount(0);
  });

  test('already-redeemed coupon: no COD APLICAT row', async ({ page }) => {
    const couponCode = 'SHOP-USED-X1Y2';
    const email = 'used@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email, usedCount: 1 });

    await recoverThenComanda(page, cartId);

    await expect(page.getByText(/cod aplicat/i)).toHaveCount(0);
  });

  test('cart without couponCode: recovery shows the cart, no coupon row', async ({
    page,
  }) => {
    const email = 'plain@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM] });

    await recoverThenComanda(page, cartId);

    await expect(page.getByText(/cod aplicat/i)).toHaveCount(0);
    // Two matches (page summary + CartSidebar drawer), so scope to first.
    await expect(
      page.getByText(/reducere de bun venit \(-10%\)/i).first(),
    ).toBeVisible();
  });

  test('/checkout shows the same coupon breakdown after recovery', async ({
    page,
  }) => {
    const couponCode = 'SHOP-CHK-OUT1';
    const email = 'chk@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    await recoverThenComanda(page, cartId);
    await page.goto('/ro/checkout');

    await expect(page.getByText(/cod aplicat/i).first()).toBeVisible();
    await expect(page.getByText(couponCode).first()).toBeVisible();
  });

  test('ramburs order POST body includes couponCode', async ({ page }) => {
    const couponCode = 'SHOP-RMB-SXYZ';
    const email = 'rmb@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    // Mock /api/order so we don't write a real order doc
    await page.route('**/api/order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 'TESTC0UP',
          success: true,
          shippingCost: 0,
          totalPrice: 599,
        }),
      });
    });

    await recoverThenComanda(page, cartId);
    await page.goto('/ro/checkout');

    await fillShipping(page, email);
    await page.getByTestId('checkout-continue-payment').click();

    const orderRequest = page.waitForRequest('**/api/order');
    await page.getByTestId('checkout-pay-method-ramburs').click();
    await page.getByTestId('checkout-confirm-ramburs').click();
    const req = await orderRequest;
    const body = JSON.parse(req.postData() ?? '{}');

    expect(body.couponCode).toBe(couponCode);
    expect(body.shipping.email).toBe(email);
  });

  test('checkout shipping email pre-fills with the coupon email', async ({ page }) => {
    const couponCode = 'SHOP-PREF-ILL1';
    const email = 'prefill@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    await recoverThenComanda(page, cartId);
    await page.goto('/ro/checkout');

    // With a known email, the page skips step 1 and renders the email
    // summary at the top of the shipping step. The summary line shows
    // the captured email verbatim.
    await expect(page.getByText(email)).toBeVisible();
  });

  test('mismatched checkout email hides the coupon row and shows a warning', async ({
    page,
  }) => {
    const couponCode = 'SHOP-MISM-EML1';
    const couponEmail = 'owner@test.example';
    await seedCart({ cartId, email: couponEmail, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email: couponEmail });

    await recoverThenComanda(page, cartId);
    await page.goto('/ro/checkout');

    // Coupon row visible at first (email pre-filled with the coupon's owner)
    await expect(page.getByText(/cod aplicat/i).first()).toBeVisible();

    // User changes the email — coupon should drop out of the breakdown
    // and the warning should appear instead.
    await changeCheckoutEmail(page, 'different@test.example');
    await expect(page.getByText(/cod aplicat/i)).toHaveCount(0);
    await expect(page.getByText(/legat de un alt email/i)).toBeVisible();
    await expect(page.getByText(couponEmail)).toBeVisible();
  });

  test('correcting the email back re-applies the coupon row', async ({ page }) => {
    const couponCode = 'SHOP-CORR-CT12';
    const couponEmail = 'roundtrip@test.example';
    await seedCart({ cartId, email: couponEmail, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email: couponEmail });

    await recoverThenComanda(page, cartId);
    await page.goto('/ro/checkout');

    // Mismatch first
    await changeCheckoutEmail(page, 'wrong@test.example');
    await expect(page.getByText(/cod aplicat/i)).toHaveCount(0);

    // Restore the original — coupon row reappears
    await changeCheckoutEmail(page, couponEmail);
    await expect(page.getByText(/cod aplicat/i).first()).toBeVisible();
  });

  test('mismatched email at order time → POST omits couponCode', async ({ page }) => {
    const couponCode = 'SHOP-NO-XCODE';
    const couponEmail = 'real@test.example';
    await seedCart({ cartId, email: couponEmail, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email: couponEmail });

    await page.route('**/api/order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 'TESTNOCP',
          success: true,
          shippingCost: 0,
          totalPrice: 674,
        }),
      });
    });

    await recoverThenComanda(page, cartId);
    await page.goto('/ro/checkout');

    // Recovery pre-filled the email with couponEmail, so we need to
    // explicitly change it to break the match before filling the rest.
    await changeCheckoutEmail(page, 'other@test.example');
    await fillShipping(page, 'other@test.example');
    await page.getByTestId('checkout-continue-payment').click();

    const orderRequest = page.waitForRequest('**/api/order');
    await page.getByTestId('checkout-pay-method-ramburs').click();
    await page.getByTestId('checkout-confirm-ramburs').click();
    const req = await orderRequest;
    const body = JSON.parse(req.postData() ?? '{}');

    // No couponCode in body since UI gated it on email match. Server
    // would have rejected it anyway, but skipping it client-side keeps
    // the displayed total honest.
    expect(body.couponCode).toBeUndefined();
    expect(body.shipping.email).toBe('other@test.example');
  });

  test('after order placed the coupon clears from localStorage', async ({ page }) => {
    const couponCode = 'SHOP-DONE-XYZ1';
    const email = 'done@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    await page.route('**/api/order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 'CLEARTST',
          success: true,
          shippingCost: 0,
          totalPrice: 599,
        }),
      });
    });

    await recoverThenComanda(page, cartId);

    // Confirm the coupon landed in localStorage during the recover hop
    const before = await page.evaluate(() => localStorage.getItem('sf_applied_coupon'));
    expect(before).not.toBeNull();

    await page.goto('/ro/checkout');
    await fillShipping(page, email);
    await page.getByTestId('checkout-continue-payment').click();
    await page.getByTestId('checkout-pay-method-ramburs').click();
    await page.getByTestId('checkout-confirm-ramburs').click();
    await page.waitForURL(/\/(confirmare|order-confirmation)\//, { timeout: 15_000 });

    const after = await page.evaluate(() => localStorage.getItem('sf_applied_coupon'));
    expect(after).toBeNull();
  });
});
