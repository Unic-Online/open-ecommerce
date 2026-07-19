import { expect, test, type APIRequestContext } from '@playwright/test';
import { e2eSecrets } from '../playwright.config';
import { closeTestDb, deleteOrder, getTestDb, seedOrder } from './fixtures/db';

test.describe('Review-request cron endpoint — auth', () => {
  test('rejects with 403 when the bearer token is missing', async ({ request }) => {
    const res = await request.get('/api/cron/review-request');
    expect(res.status()).toBe(403);
  });

  test('rejects with 403 when the bearer token is wrong', async ({ request }) => {
    const res = await request.get('/api/cron/review-request', {
      headers: { Authorization: 'Bearer obviously-wrong' },
    });
    expect(res.status()).toBe(403);
  });

  test('returns a well-formed JSON summary with the correct bearer token', async ({ request }) => {
    const res = await request.get('/api/cron/review-request', {
      headers: { Authorization: `Bearer ${e2eSecrets.cronSecret}` },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.candidates).toBe('number');
    expect(typeof json.sent).toBe('number');
    expect(typeof json.failed).toBe('number');
    expect(typeof json.eligibleBefore).toBe('string');
    expect(typeof json.eligibleAfter).toBe('string');
  });

  test('POST also works (matches the Vercel Cron GET pattern used elsewhere)', async ({ request }) => {
    const res = await request.post('/api/cron/review-request', {
      headers: { Authorization: `Bearer ${e2eSecrets.cronSecret}` },
    });
    expect(res.status()).toBe(200);
  });
});

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function runCron(request: APIRequestContext) {
  const res = await request.get('/api/cron/review-request', {
    headers: { Authorization: `Bearer ${e2eSecrets.cronSecret}` },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

async function fetchOrder(orderId: string) {
  const db = await getTestDb();
  return db.collection('orders').findOne({ orderId });
}

test.describe('Review-request cron endpoint — eligibility + idempotency', () => {
  const eligible = 'E2ERVW001';
  const tooRecent = 'E2ERVW002';
  const tooOld = 'E2ERVW003';
  const alreadySent = 'E2ERVW004';
  const cancelledOrder = 'E2ERVW005';

  test.beforeAll(async () => {
    await Promise.all([
      seedOrder({
        orderId: eligible,
        email: 'review-eligible@e2e.test',
        status: 'received',
        fulfillment: { status: 'delivered', deliveredAt: daysAgo(4) },
      }),
      seedOrder({
        orderId: tooRecent,
        email: 'review-too-recent@e2e.test',
        status: 'received',
        // Delivered yesterday — still inside the 3-day grace window.
        fulfillment: { status: 'delivered', deliveredAt: daysAgo(1) },
      }),
      seedOrder({
        orderId: tooOld,
        email: 'review-too-old@e2e.test',
        status: 'received',
        // Delivered 90 days ago — past the 60-day upper bound.
        fulfillment: { status: 'delivered', deliveredAt: daysAgo(90) },
      }),
      seedOrder({
        orderId: alreadySent,
        email: 'review-already-sent@e2e.test',
        status: 'received',
        fulfillment: {
          status: 'delivered',
          deliveredAt: daysAgo(10),
          reviewEmailSentAt: daysAgo(5),
        },
      }),
      seedOrder({
        orderId: cancelledOrder,
        email: 'review-cancelled@e2e.test',
        status: 'cancelled',
        fulfillment: { status: 'delivered', deliveredAt: daysAgo(10) },
      }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all(
      [eligible, tooRecent, tooOld, alreadySent, cancelledOrder].map((id) => deleteOrder(id)),
    );
    await closeTestDb();
  });

  test('sends only to the eligible order and marks it idempotently', async ({ request }) => {
    await runCron(request);

    const sentOrder = await fetchOrder(eligible);
    expect(sentOrder?.fulfillment?.reviewEmailSentAt).toBeTruthy();
    const firstSentAt = new Date(sentOrder!.fulfillment.reviewEmailSentAt).getTime();

    // Ineligible orders (too recent, too old, cancelled) must never get the marker.
    for (const orderId of [tooRecent, tooOld, cancelledOrder]) {
      const doc = await fetchOrder(orderId);
      expect(doc?.fulfillment?.reviewEmailSentAt, orderId).toBeFalsy();
    }

    // Second run must not re-send: the marker's timestamp stays exactly put.
    await runCron(request);
    const sentAgain = await fetchOrder(eligible);
    expect(new Date(sentAgain!.fulfillment.reviewEmailSentAt).getTime()).toBe(firstSentAt);
  });
});
