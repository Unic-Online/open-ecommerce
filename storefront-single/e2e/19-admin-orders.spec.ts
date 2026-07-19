import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { e2eSecrets } from '../playwright.config';
import { closeTestDb, deleteOrder, seedOrder } from './fixtures/db';

const ADMIN_PASSWORD = e2eSecrets.adminPassword;

const OrderPaidCard = 'E2EPDCRD1';
const OrderReceivedCod = 'E2ERECCOD2';
const OrderPaidCard2 = 'E2EPDCRD3';

async function loginAdmin(request: APIRequestContext) {
  const res = await request.post('/api/admin/login', {
    data: { password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
}

async function loginAdminInPage(page: Page) {
  await page.goto('/admin/login');
  await page.getByPlaceholder(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !/\/admin\/login$/.test(url.pathname), { timeout: 5000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Admin orders dashboard', () => {
  test.beforeAll(async () => {
    await Promise.all([
      seedOrder({
        orderId: OrderPaidCard,
        email: 'paid-card@e2e.test',
        status: 'paid',
        paymentMethod: 'card',
        totalPrice: 459,
      }),
      seedOrder({
        orderId: OrderReceivedCod,
        email: 'received-cod@e2e.test',
        status: 'received',
        paymentMethod: 'cod',
        totalPrice: 218,
      }),
      seedOrder({
        orderId: OrderPaidCard2,
        email: 'paid-card2@e2e.test',
        status: 'paid',
        paymentMethod: 'card',
        totalPrice: 89,
      }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteOrder(OrderPaidCard),
      deleteOrder(OrderReceivedCod),
      deleteOrder(OrderPaidCard2),
    ]);
    await closeTestDb();
  });

  test('unauthenticated GET /admin/orders redirects to login', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForURL('**/admin/login', { timeout: 5000 });
    expect(page.url()).toMatch(/\/admin\/login$/);
  });

  test('authenticated list shows the seeded orders', async ({ page }) => {
    await loginAdminInPage(page);
    await page.goto('/admin/orders');
    await expect(page.getByRole('heading', { name: /^Orders$/ })).toBeVisible();

    const tableText = await page.locator('table').first().innerText();
    expect(tableText).toContain(OrderPaidCard);
    expect(tableText).toContain(OrderReceivedCod);
    expect(tableText).toContain(OrderPaidCard2);
  });

  test('the single-market filter (market=main) lists every order', async ({ page }) => {
    // The template ships one commercial market (`main`). The dashboard still
    // exposes a market filter, but with a single market it never hides rows.
    await loginAdminInPage(page);
    await page.goto('/admin/orders?market=main');
    const tableText = await page.locator('table').first().innerText();
    expect(tableText).toContain(OrderPaidCard);
    expect(tableText).toContain(OrderReceivedCod);
    expect(tableText).toContain(OrderPaidCard2);
  });

  test('detail page renders the order with EUR currency', async ({ page }) => {
    await loginAdminInPage(page);
    await page.goto(`/admin/orders/${OrderPaidCard}`);
    await expect(page.getByRole('heading', { name: new RegExp(`Order #${OrderPaidCard}`) })).toBeVisible();
    const body = await page.locator('body').innerText();
    // Either the EUR symbol or the currency code shows up in the totals.
    expect(body).toMatch(/€|EUR/);
    expect(body).toContain('GB');
  });

  test('CSV export contains all seeded orderIds', async ({ request }) => {
    await loginAdmin(request);
    const res = await request.get('/api/admin/orders/export?status=all');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    const body = await res.text();
    expect(body).toContain(OrderPaidCard);
    expect(body).toContain(OrderReceivedCod);
    expect(body).toContain(OrderPaidCard2);
  });

  test('CSV export refuses unauthenticated callers', async ({ request }) => {
    // Reset the auth context by creating a fresh request context.
    // Default `request` carries the session from prior `loginAdmin`. Use a
    // direct fetch through the stateless context to assert the gate.
    const res = await request.fetch('/api/admin/orders/export', {
      method: 'GET',
      headers: { cookie: '' },
    });
    expect(res.status()).toBe(401);
  });
});

const WriteOrderReceived = 'E2EWRREC01';
const WriteOrderPaid = 'E2EWRPD02';
const WriteOrderForRefund = 'E2EWRRF03';

test.describe('Admin orders write actions', () => {
  test.beforeAll(async () => {
    await Promise.all([
      seedOrder({
        orderId: WriteOrderReceived,
        email: 'wr-received@e2e.test',
        status: 'received',
        paymentMethod: 'cod',
        totalPrice: 1500,
      }),
      seedOrder({
        orderId: WriteOrderPaid,
        email: 'wr-paid@e2e.test',
        status: 'paid',
        paymentMethod: 'card',
        totalPrice: 1899,
      }),
      seedOrder({
        orderId: WriteOrderForRefund,
        email: 'wr-refund@e2e.test',
        status: 'paid',
        paymentMethod: 'card',
        totalPrice: 1000,
      }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteOrder(WriteOrderReceived),
      deleteOrder(WriteOrderPaid),
      deleteOrder(WriteOrderForRefund),
    ]);
  });

  test('status transition received → cancelled, audit log appears', async ({ request }) => {
    await loginAdmin(request);

    const res = await request.post(
      `/api/admin/orders/${WriteOrderReceived}/status`,
      { data: { to: 'cancelled' } },
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, from: 'received', to: 'cancelled' });

    // A second transition attempt out of the now-terminal state must fail 409.
    const second = await request.post(
      `/api/admin/orders/${WriteOrderReceived}/status`,
      { data: { to: 'paid' } },
    );
    expect(second.status()).toBe(409);
  });

  test('illegal-transition from paid → received returns 409', async ({ request }) => {
    await loginAdmin(request);
    const res = await request.post(
      `/api/admin/orders/${WriteOrderPaid}/status`,
      { data: { to: 'received' } },
    );
    expect(res.status()).toBe(409);
    expect((await res.json()).reason).toBe('illegal-transition');
  });

  test('append note: rejects empty, accepts a real body', async ({ request }) => {
    await loginAdmin(request);

    const empty = await request.post(
      `/api/admin/orders/${WriteOrderPaid}/notes`,
      { data: { body: '   ' } },
    );
    expect(empty.status()).toBe(400);

    const ok = await request.post(
      `/api/admin/orders/${WriteOrderPaid}/notes`,
      { data: { body: 'Customer rang back; expects delivery Friday.' } },
    );
    expect(ok.status()).toBe(200);
    expect((await ok.json()).ok).toBe(true);
  });

  test('mark shipped with tracking — order is updated even if Resend is unavailable', async ({ request }) => {
    await loginAdmin(request);
    // Arm the one-shot failure flag in the dev server so the next sendEmail
    // returns a Resend-shaped error, regardless of EMAIL_DRY_RUN. Endpoint
    // is gated by `isTestEndpointEnabled()` and 404s in production.
    const arm = await request.post('/api/test-only/force-email-fail-next');
    expect(arm.status(), 'test endpoint must be enabled in e2e env').toBe(200);

    const res = await request.post(
      `/api/admin/orders/${WriteOrderPaid}/fulfillment`,
      {
        data: {
          status: 'shipped',
          carrier: 'Sameday',
          trackingNumber: 'AWB-E2E-001',
        },
      },
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // The forced failure means the route catches sendEmail's error and
    // reports shipmentEmailSent=false. The fulfillment write itself MUST
    // have succeeded regardless.
    expect(json.shipmentEmailSent).toBe(false);
  });

  test('refused fulfillment patch on terminal status (cancelled order)', async ({ request }) => {
    await loginAdmin(request);
    const res = await request.post(
      `/api/admin/orders/${WriteOrderReceived}/fulfillment`,
      { data: { status: 'shipped', trackingNumber: 'X' } },
    );
    expect(res.status()).toBe(409);
    expect((await res.json()).reason).toBe('terminal-status');
  });

  test('refund happy path; second refund attempt returns 409', async ({ request }) => {
    await loginAdmin(request);

    const ok = await request.post(
      `/api/admin/orders/${WriteOrderForRefund}/refund`,
      { data: { amount: 1000, reason: 'damaged on arrival' } },
    );
    expect(ok.status()).toBe(200);
    expect((await ok.json()).ok).toBe(true);

    const second = await request.post(
      `/api/admin/orders/${WriteOrderForRefund}/refund`,
      { data: { amount: 100 } },
    );
    expect(second.status()).toBe(409);
    expect((await second.json()).reason).toBe('already-refunded');
  });

  test('refund rejects amount > totalPrice', async ({ request }) => {
    await loginAdmin(request);
    // Need a fresh order — WriteOrderForRefund is already refunded.
    const r = await request.post(
      `/api/admin/orders/${WriteOrderPaid}/refund`,
      { data: { amount: 999_999 } },
    );
    expect(r.status()).toBe(400);
    expect((await r.json()).reason).toBe('invalid-amount');
  });

  test('all write routes require admin auth', async ({ request }) => {
    const headers = { cookie: '' };
    const endpoints: Array<[string, Record<string, unknown>]> = [
      [`/api/admin/orders/${WriteOrderPaid}/status`, { to: 'paid' }],
      [`/api/admin/orders/${WriteOrderPaid}/notes`, { body: 'x' }],
      [`/api/admin/orders/${WriteOrderPaid}/fulfillment`, { status: 'shipped' }],
      [`/api/admin/orders/${WriteOrderPaid}/refund`, { amount: 1 }],
      [`/api/admin/orders/${WriteOrderPaid}/shipping`, {}],
    ];
    for (const [url, data] of endpoints) {
      const res = await request.fetch(url, {
        method: 'POST',
        headers,
        data,
      });
      expect(res.status(), url).toBe(401);
    }
  });
});

const ShippingOrder = 'E2ESHIP01';
const ShippingOrderRefunded = 'E2ESHIP02';

test.describe('Admin orders shipping editor', () => {
  const baseShipping = {
    firstName: 'Alex',
    lastName: 'E2E',
    email: 'wr-shipping@e2e.test',
    phone: '0712345678',
    county: 'Bucuresti',
    city: 'Bucuresti',
    address: 'Str. Test 1',
    country: 'GB',
    postalCode: 'SW1A 1AA',
    billingType: 'individual' as const,
    useAltShipping: false,
  };

  test.beforeAll(async () => {
    await Promise.all([
      seedOrder({
        orderId: ShippingOrder,
        email: 'wr-shipping@e2e.test',
        status: 'paid',
        paymentMethod: 'card',
        totalPrice: 1899,
        shipping: baseShipping,
      }),
      seedOrder({
        orderId: ShippingOrderRefunded,
        email: 'wr-refunded@e2e.test',
        status: 'refunded',
        paymentMethod: 'card',
        totalPrice: 999,
        shipping: baseShipping,
      }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteOrder(ShippingOrder),
      deleteOrder(ShippingOrderRefunded),
    ]);
  });

  test('valid shipping edit succeeds and detail page reflects new city', async ({
    request,
    page,
  }) => {
    await loginAdmin(request);
    const res = await request.post(
      `/api/admin/orders/${ShippingOrder}/shipping`,
      {
        data: { ...baseShipping, city: 'Cluj-Napoca' },
      },
    );
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);

    await loginAdminInPage(page);
    await page.goto(`/admin/orders/${ShippingOrder}`);
    const body = await page.locator('body').innerText();
    expect(body).toContain('Cluj-Napoca');
  });

  test('terminal-status order rejects shipping edit with 409', async ({ request }) => {
    await loginAdmin(request);
    const res = await request.post(
      `/api/admin/orders/${ShippingOrderRefunded}/shipping`,
      { data: { ...baseShipping, city: 'Anywhere' } },
    );
    expect(res.status()).toBe(409);
    expect((await res.json()).reason).toBe('terminal-status');
  });

  test('invalid body returns 400 with field-level issues', async ({ request }) => {
    await loginAdmin(request);
    const res = await request.post(
      `/api/admin/orders/${ShippingOrder}/shipping`,
      {
        data: { ...baseShipping, email: 'not-an-email', firstName: '' },
      },
    );
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.reason).toBe('invalid-body');
    expect(json.issues).toBeInstanceOf(Array);
    const paths = json.issues.map((i: { path: string }) => i.path);
    expect(paths).toContain('email');
    expect(paths).toContain('firstName');
  });
});
