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

// EUR-priced sample (the single `main` market). The coupon-display surfaces
// live on the cart page (`/cart`) and checkout (`/checkout`).
const SAMPLE_ITEM = {
  id: 'furniture__oslo-nightstand',
  productType: 'furniture',
  productName: 'Oslo Nightstand',
  quantity: 1,
  image: '/images/oslo-nightstand/1.jpg',
  unitPrice: 149,
  slug: 'oslo-nightstand',
  shortName: 'Oslo Nightstand',
};

const SHIPPING = {
  firstName: 'Jane',
  lastName: 'Smith',
  phone: '+44 7700 900123',
  address: '10 Example Street',
  city: 'London',
  county: 'Greater London',
  postalCode: 'SW1A 1AA',
};

// Drive the recovery URL (which validates the coupon server-side and writes
// `sf_applied_coupon` to localStorage) then land on the cart page. The single
// `main` market prices in EUR, so the recovered EUR item survives the cart
// page's price guard — no re-seed needed. `sf_applied_coupon` + `sf_user_email`,
// written by the recovery client, drive the coupon breakdown.
async function recoverThenCart(
  page: import('@playwright/test').Page,
  cartId: string,
) {
  await page.goto(`/recover/${signRecoveryToken(cartId)}`);
  await page.waitForURL(/\/cart$/, { timeout: 10_000 });
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
  // The shipping step shows a small "Edit" link next to the email
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

  test('happy path: recover with valid coupon shows the code-applied row on /cart', async ({
    page,
  }) => {
    const couponCode = 'SHOP-TEST-A1B2';
    const email = 'happy@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    await recoverThenCart(page, cartId);

    // Green "Code applied" chip + the coupon code + the coupon's -10% suffix
    await expect(page.getByText(/code applied/i).first()).toBeVisible();
    await expect(page.getByText(couponCode).first()).toBeVisible();
    await expect(page.getByText(/-10%/).first()).toBeVisible();
    // Default welcome-discount row stays visible — both stack
    await expect(
      page.getByText(/welcome discount \(-10%\)/i).first(),
    ).toBeVisible();
  });

  test('expired coupon: recovery succeeds, no code-applied row', async ({ page }) => {
    const couponCode = 'SHOP-EXPI-RED1';
    const email = 'expired@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({
      code: couponCode,
      cartId,
      email,
      validUntil: new Date(Date.now() - 60_000),
    });

    await recoverThenCart(page, cartId);

    // Cart still restores
    await expect(page.getByRole('heading', { name: /my basket/i })).toBeVisible();
    // ...but no coupon chip
    await expect(page.getByText(/code applied/i)).toHaveCount(0);
  });

  test('already-redeemed coupon: no code-applied row', async ({ page }) => {
    const couponCode = 'SHOP-USED-X1Y2';
    const email = 'used@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email, usedCount: 1 });

    await recoverThenCart(page, cartId);

    await expect(page.getByText(/code applied/i)).toHaveCount(0);
  });

  test('cart without couponCode: recovery shows the cart, no coupon row', async ({
    page,
  }) => {
    const email = 'plain@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM] });

    await recoverThenCart(page, cartId);

    await expect(page.getByText(/code applied/i)).toHaveCount(0);
    // Two matches (page summary + CartSidebar drawer), so scope to first.
    await expect(
      page.getByText(/welcome discount \(-10%\)/i).first(),
    ).toBeVisible();
  });

  test('/checkout shows the same coupon breakdown after recovery', async ({
    page,
  }) => {
    const couponCode = 'SHOP-CHK-OUT1';
    const email = 'chk@test.example';
    await seedCart({ cartId, email, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email });

    await recoverThenCart(page, cartId);
    await page.goto('/checkout');

    await expect(page.getByText(/code applied/i).first()).toBeVisible();
    await expect(page.getByText(couponCode).first()).toBeVisible();
  });

  test('cod order POST body includes couponCode', async ({ page }) => {
    const couponCode = 'SHOP-COD-SXYZ';
    const email = 'cod@test.example';
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
          totalPrice: 119,
        }),
      });
    });

    await recoverThenCart(page, cartId);
    await page.goto('/checkout');

    await fillShipping(page, email);
    await page.getByTestId('checkout-continue-payment').click();

    const orderRequest = page.waitForRequest('**/api/order');
    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
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

    await recoverThenCart(page, cartId);
    await page.goto('/checkout');

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

    await recoverThenCart(page, cartId);
    await page.goto('/checkout');

    // Coupon row visible at first (email pre-filled with the coupon's owner)
    await expect(page.getByText(/code applied/i).first()).toBeVisible();

    // User changes the email — coupon should drop out of the breakdown
    // and the warning should appear instead.
    await changeCheckoutEmail(page, 'different@test.example');
    await expect(page.getByText(/code applied/i)).toHaveCount(0);
    await expect(page.getByText(/linked to a different email/i)).toBeVisible();
    await expect(page.getByText(couponEmail)).toBeVisible();
  });

  test('correcting the email back re-applies the coupon row', async ({ page }) => {
    const couponCode = 'SHOP-CORR-CT12';
    const couponEmail = 'roundtrip@test.example';
    await seedCart({ cartId, email: couponEmail, items: [SAMPLE_ITEM], couponCode });
    await seedCoupon({ code: couponCode, cartId, email: couponEmail });

    await recoverThenCart(page, cartId);
    await page.goto('/checkout');

    // Mismatch first
    await changeCheckoutEmail(page, 'wrong@test.example');
    await expect(page.getByText(/code applied/i)).toHaveCount(0);

    // Restore the original — coupon row reappears
    await changeCheckoutEmail(page, couponEmail);
    await expect(page.getByText(/code applied/i).first()).toBeVisible();
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
          totalPrice: 134,
        }),
      });
    });

    await recoverThenCart(page, cartId);
    await page.goto('/checkout');

    // Recovery pre-filled the email with couponEmail, so we need to
    // explicitly change it to break the match before filling the rest.
    await changeCheckoutEmail(page, 'other@test.example');
    await fillShipping(page, 'other@test.example');
    await page.getByTestId('checkout-continue-payment').click();

    const orderRequest = page.waitForRequest('**/api/order');
    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
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
          totalPrice: 119,
        }),
      });
    });

    await recoverThenCart(page, cartId);

    // Confirm the coupon landed in localStorage during the recover hop
    const before = await page.evaluate(() => localStorage.getItem('sf_applied_coupon'));
    expect(before).not.toBeNull();

    await page.goto('/checkout');
    await fillShipping(page, email);
    await page.getByTestId('checkout-continue-payment').click();
    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
    await page.waitForURL(/\/order-confirmation\//, { timeout: 15_000 });

    const after = await page.evaluate(() => localStorage.getItem('sf_applied_coupon'));
    expect(after).toBeNull();
  });
});
