import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { clearCartStorage } from './fixtures/cart';
import { e2eSecrets } from '../playwright.config';

// Re-implement the server's HMAC token format inside the test so we can
// construct deterministic recovery URLs without depending on the app
// internals at runtime. Source-of-truth: server/recovery-token.ts.
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
  // Server prefixes the kind into the HMAC input for context-binding so
  // a recovery token can't be replayed as an admin/session/magic-link
  // token. Mirror that here. Keep this string in sync with the
  // KIND_RECOVERY constant in server/recovery-token.ts.
  const sig = crypto
    .createHmac('sha256', e2eSecrets.hmacSecret)
    .update(`cart-recovery.${payload}`)
    .digest();
  return `${payload}.${base64Url(sig)}`;
}

// Single `main` market (EUR), so the recovered item carries the EUR catalog
// price or the cart page's price guard drops it on hydration.
const SAMPLE_ITEM = {
  id: 'furniture__oslo-nightstand',
  productType: 'furniture',
  productName: 'Oslo Nightstand — Recover',
  quantity: 1,
  image: '/images/oslo-nightstand/1.jpg',
  unitPrice: 149,
  slug: 'oslo-nightstand',
  shortName: 'Oslo Nightstand',
};

test.describe('Phase 3 — recovery URL flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  test('invalid token redirects to home with ?recover=invalid', async ({ page }) => {
    // The redirect is client-side (RecoverClient) — wait for it instead of
    // sampling page.url() right after load, which races on slow machines.
    await page.goto('/recover/this-is-not-a-valid-token');
    await page.waitForURL(/\/\?recover=invalid$/);
  });

  test('expired token redirects to home with ?recover=invalid', async ({ page }) => {
    // exp in the past
    const cartId = crypto.randomUUID();
    const token = signRecoveryToken(cartId, -1);
    await page.goto(`/recover/${token}`);
    await page.waitForURL(/\/\?recover=invalid$/);
  });

  test('unknown but well-signed cartId redirects with ?recover=missing', async ({ page }) => {
    // Valid signature for a cartId that never made it to the carts collection.
    const cartId = crypto.randomUUID();
    const token = signRecoveryToken(cartId);
    await page.goto(`/recover/${token}`);
    await page.waitForURL(/\/\?recover=missing$/);
  });

  test('valid token with seeded cart pins the cookie and lands on the cart page', async ({
    page,
    request,
  }) => {
    const cartId = crypto.randomUUID();

    // Seed a cart by hitting /api/cart/sync directly with the chosen UUID.
    const syncRes = await request.post('/api/cart/sync', {
      // First hit may compile the route on-demand in dev — outlast that.
      timeout: 30_000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
        Origin: 'http://localhost:3000',
      },
      data: {
        cartId,
        items: [SAMPLE_ITEM],
        subtotal: 149,
        email: 'recover-target@playwright.test',
        marketingConsent: false,
        botCheck: 'abcd',
      },
    });
    expect(syncRes.status()).toBe(200);

    const token = signRecoveryToken(cartId);
    await page.goto(`/recover/${token}`);

    // The recovery client routes to the canonical cart page (`/cart`); the
    // single-language template has no locale prefix.
    await page.waitForURL(/\/cart$/, { timeout: 20_000 });

    // The recovered items survive the redirect: they were written to
    // localStorage at the single market's EUR price, and the cart page's
    // price guard keeps them.
    const storedCart = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('storefront-cart') ?? '[]'),
    );
    expect(storedCart).toHaveLength(1);
    expect(storedCart[0].slug).toBe(SAMPLE_ITEM.slug);

    // The core recovery contract: the server recognized the signed token and
    // pinned the session to the seeded cartId via Set-Cookie so subsequent
    // /api/cart/sync calls reuse the same cart document.
    const cookies = await page.context().cookies();
    const cartCookie = cookies.find((c) => c.name === 'sf_cart_id');
    expect(cartCookie?.value).toBe(cartId);
  });
});
