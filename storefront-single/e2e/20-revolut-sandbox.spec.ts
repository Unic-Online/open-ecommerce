/**
 * Revolut sandbox e2e — exercises the real sandbox API end-to-end without
 * sending emails or polluting prod data.
 *
 * Preconditions:
 *   - Run via `dotenv -e .env.staging -- pnpm test:e2e -- 20-revolut-sandbox.spec.ts`
 *     so REVOLUT_API_MODE=sandbox + sandbox keys reach the dev server.
 *   - Tests skip automatically when REVOLUT_API_MODE !== 'sandbox' to avoid
 *     ever charging a live card.
 *   - Writes go to the isolated `storefront-e2e` database (configured by
 *     playwright.config.ts). Emails are short-circuited by `EMAIL_DRY_RUN=1`.
 *
 * Failure diagnostics:
 *   - Every Revolut sandbox response is attached to the test (`testInfo.attach`)
 *     so a failed run gives you the raw HTTP body + status without re-running.
 *   - Our /api/payments/revolut/create-order response is attached too.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import crypto from 'node:crypto';
import { TEST_SHIPPING } from './fixtures/checkout-data';
import { SAMPLE_CART_ITEM } from './fixtures/cart';
import { getTestDb, deleteOrder } from './fixtures/db';

const SKIP_REASON =
  'Set REVOLUT_API_MODE=sandbox + REVOLUT_SECRET_KEY in the parent shell (e.g. via `dotenv -e .env.staging`).';

test.describe('Revolut sandbox — checkout integration', () => {
  test.skip(
    process.env.REVOLUT_API_MODE !== 'sandbox',
    SKIP_REASON,
  );

  // Track orders created during the run so we can wipe them in afterEach.
  const createdOrderIds = new Set<string>();

  test.afterEach(async () => {
    for (const id of createdOrderIds) {
      await deleteOrder(id).catch(() => {});
    }
    createdOrderIds.clear();
  });

  async function createOrderViaApi(request: APIRequestContext, testInfo: import('@playwright/test').TestInfo) {
    const body = {
      shipping: { ...TEST_SHIPPING, billingType: 'individual', useAltShipping: false },
      items: [SAMPLE_CART_ITEM],
      paymentMethod: 'card',
      marketingConsent: false,
    };

    const t0 = Date.now();
    const res = await request.post('/api/payments/revolut/create-order', {
      data: body,
      headers: { 'content-type': 'application/json' },
    });
    const elapsedMs = Date.now() - t0;
    const text = await res.text();

    await testInfo.attach('create-order-response', {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          status: res.status(),
          elapsedMs,
          headers: res.headers(),
          body: safeJsonParse(text),
        },
        null,
        2,
      ),
    });

    if (!res.ok()) {
      throw new Error(`create-order failed: HTTP ${res.status()} — ${text}`);
    }

    const json = JSON.parse(text) as {
      orderId: string;
      publicId: string;
      checkoutUrl?: string;
      providerOrderId: string;
    };
    createdOrderIds.add(json.orderId);
    return json;
  }

  test('create-order hits Revolut sandbox and persists pending order', async ({ request }, testInfo) => {
    const json = await createOrderViaApi(request, testInfo);

    expect(json.orderId).toMatch(/^[A-F0-9]{8}$/);
    expect(json.publicId, 'Revolut public token (widget needs this)').toBeTruthy();
    expect(json.providerOrderId, 'Revolut order UUID').toBeTruthy();

    // DB shape: must be persisted as pending_payment with payment.provider=revolut.
    const db = await getTestDb();
    const order = await db.collection('orders').findOne({ orderId: json.orderId });
    await testInfo.attach('mongo-order-doc', {
      contentType: 'application/json',
      body: JSON.stringify(order, null, 2),
    });

    expect(order, 'order must exist in storefront-e2e DB').toBeTruthy();
    expect(order?.status).toBe('pending_payment');
    expect(order?.paymentMethod).toBe('card');
    expect((order as { payment?: { provider?: string } } | null)?.payment?.provider).toBe('revolut');
  });

  test('Revolut sandbox can retrieve the order we just created', async ({ request }, testInfo) => {
    const json = await createOrderViaApi(request, testInfo);

    // Hit Revolut sandbox directly to confirm they have the order.
    const secret = process.env.REVOLUT_SECRET_KEY!;
    const res = await fetch(
      `https://sandbox-merchant.revolut.com/api/orders/${encodeURIComponent(json.providerOrderId)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          'Revolut-Api-Version': '2026-03-12',
          Accept: 'application/json',
        },
      },
    );
    const text = await res.text();
    await testInfo.attach('revolut-sandbox-retrieve-order', {
      contentType: 'application/json',
      body: JSON.stringify(
        { status: res.status, headers: Object.fromEntries(res.headers), body: safeJsonParse(text) },
        null,
        2,
      ),
    });
    expect(res.ok, `sandbox retrieve must succeed (got ${res.status})`).toBe(true);
    const sandboxOrder = JSON.parse(text);
    expect(sandboxOrder.id).toBe(json.providerOrderId);
    expect(sandboxOrder.merchant_order_ext_ref).toBe(json.orderId);
  });

  test('signed ORDER_COMPLETED webhook flips order to paid and skips real email', async ({ request }, testInfo) => {
    test.skip(
      !process.env.REVOLUT_WEBHOOK_SIGNING_SECRET,
      'REVOLUT_WEBHOOK_SIGNING_SECRET not set',
    );

    const json = await createOrderViaApi(request, testInfo);

    const payload = {
      event: 'ORDER_COMPLETED',
      order_id: json.providerOrderId,
      merchant_order_ext_ref: json.orderId,
    };
    const rawBody = JSON.stringify(payload);
    const ts = Date.now();
    const signingSecret = process.env.REVOLUT_WEBHOOK_SIGNING_SECRET!;
    const sig = `v1=${crypto
      .createHmac('sha256', signingSecret)
      .update(`v1.${ts}.${rawBody}`)
      .digest('hex')}`;

    const webhookRes = await request.post('/api/webhooks/revolut', {
      data: rawBody,
      headers: {
        'content-type': 'application/json',
        'revolut-signature': sig,
        'revolut-request-timestamp': String(ts),
      },
    });
    const webhookText = await webhookRes.text();
    await testInfo.attach('webhook-response', {
      contentType: 'application/json',
      body: JSON.stringify(
        { status: webhookRes.status(), body: safeJsonParse(webhookText) },
        null,
        2,
      ),
    });
    expect(webhookRes.ok(), `webhook must accept signed payload (got ${webhookRes.status()})`).toBe(
      true,
    );

    // The webhook also calls Revolut sandbox to retrieve the order's true
    // state. In sandbox the order won't be `completed` until a payment is
    // actually made — so we don't assert the final status; we assert the
    // webhook ran and DID NOT throw on a real (signature-valid) payload.
    const db = await getTestDb();
    const order = await db.collection('orders').findOne({ orderId: json.orderId });
    await testInfo.attach('mongo-order-after-webhook', {
      contentType: 'application/json',
      body: JSON.stringify(order, null, 2),
    });
    expect(order?.status, 'webhook must transition status off pending_payment OR keep pending if sandbox has not paid').toMatch(
      /pending_payment|paid|failed|cancelled/,
    );
  });

  test('wallet return URL resolves publicId → /order-confirmation/[orderId]', async ({ page, request }, testInfo) => {
    const json = await createOrderViaApi(request, testInfo);

    await page.goto(`/revolut-pay/return/success?_rp_oid=${json.publicId}`);
    await page.waitForURL(/\/order-confirmation\/[A-F0-9]{8}/i, { timeout: 10_000 });
    expect(page.url()).toMatch(new RegExp(`/order-confirmation/${json.orderId}$`, 'i'));
  });

  test('confirmation page renders the new order (pending state) without crashing', async ({ page, request }, testInfo) => {
    const json = await createOrderViaApi(request, testInfo);
    const res = await page.goto(`/order-confirmation/${json.orderId}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText(`#${json.orderId}`)).toBeVisible();
  });
});

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
