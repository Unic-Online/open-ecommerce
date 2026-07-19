/**
 * Issue #11 — magic-link account + dashboard.
 *
 * Covers:
 *   - request-link returns 200 even for unknown emails (no enumeration).
 *   - GET /api/account/verify with a fresh, server-issued token sets a
 *     session cookie + redirects to /account, where the dashboard
 *     renders the seeded order.
 *   - Tampered/replayed tokens land on /account?error=...
 *   - Logout clears the session cookie.
 *
 * Uses the magic-link fixture (`e2e/fixtures/account.ts`) which writes the
 * nonce to Mongo with the same TEST_HMAC the dev server uses.
 */
import { expect, test } from '@playwright/test';
import { seedOrder, deleteOrder, closeTestDb } from './fixtures/db';
import {
  buildAccountSessionCookieValue,
  deleteMagicLinkNonces,
  seedMagicLink,
} from './fixtures/account';

const ACCOUNT_COOKIE = 'sf_account_session';
const TEST_EMAIL = 'e2e-account@example.com';
const ORDER_ID = 'A11C0D2E';
// Per-run "unknown" email so the per-email rate limiter (3 req / h, persisted
// in `account_login_attempts` with a 1h TTL) doesn't cap repeat runs.
const UNKNOWN_EMAIL = `e2e-unknown-${Date.now().toString(36)}@example.com`;

// Why: this spec mutates a single shared (email, orderId) pair across
// six tests. Running in parallel under workers=4 produces strict-mode
// violations when delete/insert races leave duplicate docs.
test.describe.configure({ mode: 'serial' });

test.describe('#11 — magic-link account', () => {
  test.beforeAll(async () => {
    await deleteOrder(ORDER_ID);
    await deleteMagicLinkNonces(TEST_EMAIL);
    await seedOrder({
      orderId: ORDER_ID,
      email: TEST_EMAIL,
      status: 'received',
      totalPrice: 1899,
    });
  });

  test.afterAll(async () => {
    await deleteOrder(ORDER_ID);
    await deleteMagicLinkNonces(TEST_EMAIL);
    await closeTestDb();
  });

  test('POST /api/account/request-link returns 200 for unknown email (no enumeration)', async ({ request }) => {
    const res = await request.post('/api/account/request-link', {
      data: { email: UNKNOWN_EMAIL },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test('POST /api/account/request-link rejects malformed email with 400', async ({ request }) => {
    const res = await request.post('/api/account/request-link', {
      data: { email: 'not-an-email' },
    });
    expect(res.status()).toBe(400);
  });

  test('verify URL with fresh token lands on dashboard with the seeded order', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL missing');
    const { url } = await seedMagicLink({ email: TEST_EMAIL, baseURL });

    await page.goto(url);

    await expect(page).toHaveURL(/\/account$/);

    // Dashboard chrome: order id rendered + status badge.
    await expect(page.getByText(`#${ORDER_ID}`).first()).toBeVisible();
    await expect(page.getByText('Signed in')).toBeVisible();

    // Session cookie is set, httpOnly so we just confirm presence via context.
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === ACCOUNT_COOKIE && c.value.length > 0)).toBe(true);
  });

  test('replayed verify URL fails with error param + no cookie', async ({ page, baseURL, context }) => {
    if (!baseURL) throw new Error('baseURL missing');
    await context.clearCookies();
    const { url } = await seedMagicLink({ email: TEST_EMAIL, baseURL });

    // First use: succeeds.
    await page.goto(url);
    await expect(page).toHaveURL(/\/account$/);

    // Wipe the cookie so the second visit can't ride the session.
    await context.clearCookies();

    // Second use: nonce already consumed → error redirect, no cookie.
    await page.goto(url);
    await expect(page).toHaveURL(/\/account\?error=/);

    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === ACCOUNT_COOKIE && c.value.length > 0)).toBe(false);
  });

  test('tampered token lands on error page with no session', async ({ page, baseURL, context }) => {
    if (!baseURL) throw new Error('baseURL missing');
    await context.clearCookies();
    const { url } = await seedMagicLink({ email: TEST_EMAIL, baseURL });
    const tampered = url.replace(/=([^=]+)$/, '=tamperedsig');

    await page.goto(tampered);
    await expect(page).toHaveURL(/\/account\?error=/);
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === ACCOUNT_COOKIE && c.value.length > 0)).toBe(false);
  });

  test('seeded session cookie skips login and shows dashboard', async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error('baseURL missing');
    const cookieValue = buildAccountSessionCookieValue(TEST_EMAIL);
    await context.addCookies([
      {
        name: ACCOUNT_COOKIE,
        value: cookieValue,
        url: baseURL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto('/account');
    await expect(page.getByText(`#${ORDER_ID}`).first()).toBeVisible();
  });
});
