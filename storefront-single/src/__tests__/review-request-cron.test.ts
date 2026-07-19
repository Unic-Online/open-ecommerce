import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Db } from 'mongodb';
import { resendLibModule, sendEmailMock } from './helpers/resend.mock';
import { buildOrder } from './helpers/builders';

const { mockMarkReviewEmailSent, mockMarkReviewEmailFailed, mockCaptureError } = vi.hoisted(() => ({
  mockMarkReviewEmailSent: vi.fn(),
  mockMarkReviewEmailFailed: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock('@/lib/resend', () => resendLibModule());
vi.mock('@/lib/orders/mutations', () => ({
  markReviewEmailSent: mockMarkReviewEmailSent,
  markReviewEmailFailed: mockMarkReviewEmailFailed,
}));
vi.mock('@/lib/error-sink', () => ({
  captureError: mockCaptureError,
}));

import {
  BATCH_LIMIT,
  REVIEW_REQUEST_DELAY_DAYS,
  REVIEW_REQUEST_MAX_AGE_DAYS,
  buildEligibilityFilter,
  runReviewRequestCron,
} from '@/lib/orders/review-request-cron';
import { ORDERS_COLLECTION } from '@/lib/orders/types';
import { reviewRequestEmailSubject } from '@/lib/emails/review-request';

// The rendered email signs a per-product review token, which needs the
// shared HMAC secret (see lib/orders/review-token.ts).
const SECRET = 'test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod';
let originalSecret: string | undefined;

function deliveredOrder(overrides: Record<string, unknown> = {}) {
  return buildOrder({
    orderId: 'DLVR0001',
    fulfillment: { status: 'delivered', deliveredAt: new Date('2026-07-01T00:00:00.000Z') },
    ...overrides,
  });
}

function makeDb(orders: unknown[]) {
  const toArray = vi.fn().mockResolvedValue(orders);
  const limit = vi.fn().mockReturnValue({ toArray });
  const find = vi.fn().mockReturnValue({ limit });
  const collection = vi.fn().mockReturnValue({ find });
  return { db: { collection } as unknown as Db, collection, find, limit };
}

beforeEach(() => {
  vi.clearAllMocks();
  originalSecret = process.env.CART_RECOVERY_HMAC_SECRET;
  process.env.CART_RECOVERY_HMAC_SECRET = SECRET;
  sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
  mockMarkReviewEmailSent.mockResolvedValue(undefined);
  mockMarkReviewEmailFailed.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CART_RECOVERY_HMAC_SECRET;
  else process.env.CART_RECOVERY_HMAC_SECRET = originalSecret;
});

describe('review-request cron constants', () => {
  it('waits 3 days, ignores deliveries older than 60 days, batches at 100', () => {
    expect(REVIEW_REQUEST_DELAY_DAYS).toBe(3);
    expect(REVIEW_REQUEST_MAX_AGE_DAYS).toBe(60);
    expect(BATCH_LIMIT).toBe(100);
  });
});

describe('buildEligibilityFilter', () => {
  it('gates on delivered status, a 3..60 day deliveredAt window, missing reviewEmailSentAt, non-terminal order', () => {
    const now = new Date('2026-07-05T00:00:00.000Z');
    expect(buildEligibilityFilter(now)).toEqual({
      'fulfillment.status': 'delivered',
      'fulfillment.deliveredAt': {
        $lte: new Date('2026-07-02T00:00:00.000Z'),
        $gte: new Date('2026-05-06T00:00:00.000Z'),
      },
      'fulfillment.reviewEmailSentAt': { $exists: false },
      status: { $nin: ['cancelled', 'refunded'] },
    });
  });
});

describe('runReviewRequestCron', () => {
  it('queries the orders collection with the eligibility filter and batch limit', async () => {
    const { db, collection, find, limit } = makeDb([]);
    const now = new Date('2026-07-05T12:00:00.000Z');

    const summary = await runReviewRequestCron(db, { now });

    expect(collection).toHaveBeenCalledWith(ORDERS_COLLECTION);
    expect(find).toHaveBeenCalledWith(buildEligibilityFilter(now));
    expect(limit).toHaveBeenCalledWith(BATCH_LIMIT);
    expect(summary).toMatchObject({ ok: true, candidates: 0, sent: 0, failed: 0 });
  });

  it('sends an email per eligible order and marks it sent (idempotency marker)', async () => {
    const order = deliveredOrder();
    const { db } = makeDb([order]);

    const summary = await runReviewRequestCron(db, { now: new Date('2026-07-05T00:00:00Z') });

    expect(summary).toMatchObject({ candidates: 1, sent: 1, failed: 0 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sentArgs = sendEmailMock.mock.calls[0][0];
    expect(sentArgs.to).toEqual([order.email]);
    expect(sentArgs.subject).toBe(reviewRequestEmailSubject(order));
    expect(mockMarkReviewEmailSent).toHaveBeenCalledWith('DLVR0001', expect.any(Date));
    expect(mockMarkReviewEmailFailed).not.toHaveBeenCalled();
  });

  it('marks the order failed (not sent) when Resend throws, and does not abort the batch', async () => {
    sendEmailMock
      .mockRejectedValueOnce(new Error('Resend down'))
      .mockResolvedValueOnce({ data: { id: 'ok' }, error: null });
    const { db } = makeDb([
      deliveredOrder({ orderId: 'BAD00001' }),
      deliveredOrder({ orderId: 'OK000002' }),
    ]);

    const summary = await runReviewRequestCron(db, { now: new Date('2026-07-05T00:00:00Z') });

    expect(summary).toMatchObject({ candidates: 2, sent: 1, failed: 1 });
    expect(mockMarkReviewEmailFailed).toHaveBeenCalledWith(
      'BAD00001',
      'Resend down',
      expect.any(Date),
    );
    expect(mockMarkReviewEmailSent).toHaveBeenCalledWith('OK000002', expect.any(Date));
  });

  it('does not abort the batch when the failure-bookkeeping write itself throws', async () => {
    sendEmailMock
      .mockRejectedValueOnce(new Error('Resend down'))
      .mockResolvedValueOnce({ data: { id: 'ok' }, error: null });
    mockMarkReviewEmailFailed.mockRejectedValueOnce(new Error('mongo write lost'));
    const { db } = makeDb([
      deliveredOrder({ orderId: 'BAD00001' }),
      deliveredOrder({ orderId: 'OK000002' }),
    ]);

    const summary = await runReviewRequestCron(db, { now: new Date('2026-07-05T00:00:00Z') });

    expect(summary).toMatchObject({ candidates: 2, sent: 1, failed: 1 });
  });

  it('alerts the error sink with orderId context when a send throws', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('boom'));
    const { db } = makeDb([deliveredOrder({ orderId: 'BAD00002' })]);

    await runReviewRequestCron(db, { now: new Date('2026-07-05T00:00:00Z') });

    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ orderId: 'BAD00002' }),
      expect.objectContaining({ tag: 'review_request_email' }),
    );
  });
});
