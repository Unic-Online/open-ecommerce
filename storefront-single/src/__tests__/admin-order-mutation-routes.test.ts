/**
 * Route-level contracts for the admin order mutation endpoints: auth gating,
 * body validation, reason→HTTP mapping, and the shipment-email idempotency
 * flow on the fulfillment route. The underlying atomic Mongo contracts
 * (ALLOWED_FROM $in filters, terminal-status $nin, refund bounds, pipeline
 * audit snapshots) are covered at lib level in `orders-mutations.test.ts` —
 * these tests pin how each route exposes them.
 *
 * Uses the shared helpers from `./helpers/`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mongoMock } from './helpers/mongodb.mock';
import { resendLibModule, sendEmailMock } from './helpers/resend.mock';
import { buildOrder, buildShipping } from './helpers/builders';

const {
  mockRequireAdmin,
  mockTransitionStatus,
  mockAppendNote,
  mockRecordRefund,
  mockEditShipping,
  mockSetFulfillment,
  mockMarkShipmentEmailSent,
  mockMarkShipmentEmailFailed,
  mockGetOrder,
  mockIssueMagicLink,
  mockIsDryRun,
  mockCaptureError,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockTransitionStatus: vi.fn(),
  mockAppendNote: vi.fn(),
  mockRecordRefund: vi.fn(),
  mockEditShipping: vi.fn(),
  mockSetFulfillment: vi.fn(),
  mockMarkShipmentEmailSent: vi.fn(),
  mockMarkShipmentEmailFailed: vi.fn(),
  mockGetOrder: vi.fn(),
  mockIssueMagicLink: vi.fn(),
  mockIsDryRun: vi.fn(() => false),
  mockCaptureError: vi.fn(),
}));

vi.mock('@/plugins/abandoned-cart/server/admin-auth', () => ({
  requireAdmin: mockRequireAdmin,
}));
vi.mock('@/lib/orders/mutations', () => ({
  transitionStatus: mockTransitionStatus,
  appendNote: mockAppendNote,
  recordRefund: mockRecordRefund,
  editShipping: mockEditShipping,
  setFulfillment: mockSetFulfillment,
  markShipmentEmailSent: mockMarkShipmentEmailSent,
  markShipmentEmailFailed: mockMarkShipmentEmailFailed,
}));
vi.mock('@/lib/orders/queries', () => ({ getOrder: mockGetOrder }));
vi.mock('@/lib/resend', () => resendLibModule());
vi.mock('@/lib/mongodb', () => mongoMock.module());
vi.mock('@/lib/account-tokens', () => ({
  issueMagicLinkForEmail: mockIssueMagicLink,
}));
vi.mock('@/plugins/abandoned-cart/config', () => ({
  isAbandonedCartDryRun: mockIsDryRun,
}));
vi.mock('@/lib/error-sink', () => ({ captureError: mockCaptureError }));

import { POST as statusPOST } from '@/app/api/admin/orders/[orderId]/status/route';
import { POST as notesPOST } from '@/app/api/admin/orders/[orderId]/notes/route';
import { POST as refundPOST } from '@/app/api/admin/orders/[orderId]/refund/route';
import { POST as shippingPOST } from '@/app/api/admin/orders/[orderId]/shipping/route';
import { POST as fulfillmentPOST } from '@/app/api/admin/orders/[orderId]/fulfillment/route';
import { POST as resendEmailPOST } from '@/app/api/admin/orders/[orderId]/resend-email/route';
import { POST as resendShipmentPOST } from '@/app/api/admin/orders/[orderId]/resend-shipment-email/route';
import { ORDERS_COLLECTION } from '@/lib/orders/types';

type RouteHandler = (
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) => Promise<Response>;

function call(handler: RouteHandler, orderId: string, body?: unknown): Promise<Response> {
  const request = new Request(`http://localhost/api/admin/orders/${orderId}/x`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? '{not json' : JSON.stringify(body),
  });
  return handler(request, { params: Promise.resolve({ orderId }) });
}

beforeEach(() => {
  mongoMock.reset();
  mockRequireAdmin.mockResolvedValue(true);
  mockIsDryRun.mockReturnValue(false);
  mockIssueMagicLink.mockResolvedValue('https://shop.example.com/api/account/verify?token=t');
  sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
});

describe('auth gate — every mutation route returns 401 without an admin session', () => {
  it.each([
    ['status', statusPOST, { to: 'paid' }],
    ['notes', notesPOST, { body: 'note' }],
    ['refund', refundPOST, { amount: 10 }],
    ['shipping', shippingPOST, buildShipping()],
    ['fulfillment', fulfillmentPOST, { status: 'shipped' }],
    ['resend-email', resendEmailPOST, {}],
    ['resend-shipment-email', resendShipmentPOST, {}],
  ] as const)('%s → 401, no downstream call', async (_name, handler, body) => {
    mockRequireAdmin.mockResolvedValue(false);
    const res = await call(handler as RouteHandler, 'ABCD1234', body);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, reason: 'unauthenticated' });
    for (const m of [
      mockTransitionStatus,
      mockAppendNote,
      mockRecordRefund,
      mockEditShipping,
      mockSetFulfillment,
      sendEmailMock,
    ]) {
      expect(m).not.toHaveBeenCalled();
    }
  });
});

describe('POST /status', () => {
  it('400 on a non-JSON body', async () => {
    const res = await call(statusPOST, 'ABCD1234');
    expect(res.status).toBe(400);
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  it('400 when `to` is not a known order status', async () => {
    const res = await call(statusPOST, 'ABCD1234', { to: 'shipped' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: 'malformed' });
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  it('200 with from/to on success', async () => {
    mockTransitionStatus.mockResolvedValueOnce({ ok: true, from: 'received' });
    const res = await call(statusPOST, 'ABCD1234', { to: 'cancelled' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, from: 'received', to: 'cancelled' });
    expect(mockTransitionStatus).toHaveBeenCalledWith('ABCD1234', 'cancelled');
  });

  it.each([
    ['illegal-transition', 409],
    ['not-found', 404],
    ['dry-run', 503],
  ] as const)('maps %s → %d', async (reason, status) => {
    mockTransitionStatus.mockResolvedValueOnce({ ok: false, reason });
    const res = await call(statusPOST, 'ABCD1234', { to: 'paid' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, reason });
  });
});

describe('POST /notes', () => {
  it('400 when body is not a string', async () => {
    const res = await call(notesPOST, 'ABCD1234', { body: 42 });
    expect(res.status).toBe(400);
    expect(mockAppendNote).not.toHaveBeenCalled();
  });

  it('400 on whitespace-only note', async () => {
    const res = await call(notesPOST, 'ABCD1234', { body: '   \n ' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: 'empty' });
  });

  it('413 when the trimmed note exceeds 4 KB', async () => {
    const res = await call(notesPOST, 'ABCD1234', { body: 'x'.repeat(4097) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ ok: false, reason: 'too-long' });
    expect(mockAppendNote).not.toHaveBeenCalled();
  });

  it('200 appends the trimmed note', async () => {
    mockAppendNote.mockResolvedValueOnce({ ok: true });
    const res = await call(notesPOST, 'ABCD1234', { body: '  client called  ' });
    expect(res.status).toBe(200);
    expect(mockAppendNote).toHaveBeenCalledWith('ABCD1234', 'client called');
  });

  it('404 when the order does not exist', async () => {
    mockAppendNote.mockResolvedValueOnce({ ok: false, reason: 'not-found' });
    const res = await call(notesPOST, 'ABCD1234', { body: 'n' });
    expect(res.status).toBe(404);
  });
});

describe('POST /refund', () => {
  it('400 when amount is missing or not a finite number', async () => {
    for (const amount of [undefined, 'ten', NaN, Infinity]) {
      const res = await call(refundPOST, 'ABCD1234', { amount });
      expect(res.status).toBe(400);
    }
    expect(mockRecordRefund).not.toHaveBeenCalled();
  });

  it.each([
    ['not-found', 404],
    ['already-refunded', 409],
    ['illegal-transition', 409],
    ['invalid-amount', 400],
    ['dry-run', 503],
  ] as const)('maps %s → %d', async (reason, status) => {
    mockRecordRefund.mockResolvedValueOnce({ ok: false, reason });
    const res = await call(refundPOST, 'ABCD1234', { amount: 100 });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, reason });
  });

  it('200 passes trimmed+bounded reason/reference; empty strings become undefined', async () => {
    mockRecordRefund.mockResolvedValueOnce({ ok: true });
    const res = await call(refundPOST, 'ABCD1234', {
      amount: 100,
      reason: `  duplicate payment ${'r'.repeat(600)}`,
      reference: '   ',
    });
    expect(res.status).toBe(200);
    const [, payload] = mockRecordRefund.mock.calls[0];
    expect(payload.amount).toBe(100);
    expect(payload.reason).toHaveLength(500);
    expect(payload.reason.startsWith('duplicate payment')).toBe(true);
    expect(payload.reference).toBeUndefined();
  });
});

describe('POST /shipping', () => {
  it('400 with field-level issues when the body fails shippingSchema', async () => {
    const res = await call(shippingPOST, 'ABCD1234', { firstName: 'Ion' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe('invalid-body');
    expect(body.issues.length).toBeGreaterThan(0);
    expect(mockEditShipping).not.toHaveBeenCalled();
  });

  it('200 forwards the parsed shipping object', async () => {
    mockEditShipping.mockResolvedValueOnce({ ok: true });
    const shipping = buildShipping({ city: 'Cluj-Napoca' });
    const res = await call(shippingPOST, 'ABCD1234', shipping);
    expect(res.status).toBe(200);
    expect(mockEditShipping).toHaveBeenCalledWith(
      'ABCD1234',
      expect.objectContaining({ city: 'Cluj-Napoca' }),
    );
  });

  it.each([
    ['not-found', 404],
    ['terminal-status', 409],
    ['dry-run', 503],
  ] as const)('maps %s → %d', async (reason, status) => {
    mockEditShipping.mockResolvedValueOnce({ ok: false, reason });
    const res = await call(shippingPOST, 'ABCD1234', buildShipping());
    expect(res.status).toBe(status);
  });
});

describe('POST /fulfillment', () => {
  it('400 on unknown fulfillment status, non-string carrier, or an empty patch', async () => {
    for (const body of [{ status: 'lost' }, { carrier: 7 }, {}]) {
      const res = await call(fulfillmentPOST, 'ABCD1234', body);
      expect(res.status).toBe(400);
    }
    expect(mockSetFulfillment).not.toHaveBeenCalled();
  });

  it.each([
    ['not-found', 404],
    ['terminal-status', 409],
    ['dry-run', 503],
  ] as const)('maps %s → %d', async (reason, status) => {
    mockSetFulfillment.mockResolvedValueOnce({ ok: false, reason });
    const res = await call(fulfillmentPOST, 'ABCD1234', { status: 'shipped' });
    expect(res.status).toBe(status);
  });

  it('patch without shipment-email need → 200, no email sent', async () => {
    mockSetFulfillment.mockResolvedValueOnce({
      ok: true,
      needsShipmentEmail: false,
      order: buildOrder(),
    });
    const res = await call(fulfillmentPOST, 'ABCD1234', { carrier: ' DPD  ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, shipmentEmailSent: false });
    // Carrier is trimmed before hitting the lib.
    expect(mockSetFulfillment).toHaveBeenCalledWith('ABCD1234', { carrier: 'DPD' });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(mockMarkShipmentEmailSent).not.toHaveBeenCalled();
  });

  it('shipped+tracking with no prior send → sends the email once and records the idempotency marker', async () => {
    const order = buildOrder({
      fulfillment: { status: 'shipped', trackingNumber: 'AWB123' },
    });
    mockSetFulfillment.mockResolvedValueOnce({
      ok: true,
      needsShipmentEmail: true,
      order,
    });
    const res = await call(fulfillmentPOST, 'ABCD1234', {
      status: 'shipped',
      trackingNumber: 'AWB123',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, shipmentEmailSent: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: [order.email] }),
    );
    expect(mockMarkShipmentEmailSent).toHaveBeenCalledWith('ABCD1234', expect.any(Date));
    expect(mockMarkShipmentEmailFailed).not.toHaveBeenCalled();
  });

  it('send failure → marker NOT set, failure recorded, response still ok with sendError', async () => {
    mockSetFulfillment.mockResolvedValueOnce({
      ok: true,
      needsShipmentEmail: true,
      order: buildOrder({ fulfillment: { status: 'shipped', trackingNumber: 'AWB123' } }),
    });
    sendEmailMock.mockRejectedValueOnce(new Error('resend down'));
    const res = await call(fulfillmentPOST, 'ABCD1234', { status: 'shipped' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      shipmentEmailSent: false,
      sendError: 'resend down',
    });
    expect(mockMarkShipmentEmailSent).not.toHaveBeenCalled();
    expect(mockMarkShipmentEmailFailed).toHaveBeenCalledWith(
      'ABCD1234',
      'resend down',
      expect.any(Date),
    );
  });

  it('magic-link issuance failure is best-effort — the shipment email still goes out', async () => {
    mockSetFulfillment.mockResolvedValueOnce({
      ok: true,
      needsShipmentEmail: true,
      order: buildOrder({ fulfillment: { status: 'shipped', trackingNumber: 'AWB123' } }),
    });
    mockIssueMagicLink.mockRejectedValueOnce(new Error('mongo blip'));
    const res = await call(fulfillmentPOST, 'ABCD1234', { status: 'shipped' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, shipmentEmailSent: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /resend-email', () => {
  it('503 in dry-run mode (no DB)', async () => {
    mockIsDryRun.mockReturnValue(true);
    const res = await call(resendEmailPOST, 'ABCD1234', {});
    expect(res.status).toBe(503);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('404 when the order does not exist', async () => {
    mockGetOrder.mockResolvedValueOnce(null);
    const res = await call(resendEmailPOST, 'ABCD1234', {});
    expect(res.status).toBe(404);
  });

  it('502 send-failed without an audit write', async () => {
    mockGetOrder.mockResolvedValueOnce(buildOrder());
    sendEmailMock.mockRejectedValueOnce(new Error('resend 500'));
    const res = await call(resendEmailPOST, 'ABCD1234', {});
    expect(res.status).toBe(502);
    expect((await res.json()).reason).toBe('send-failed');
    expect(mongoMock.collection(ORDERS_COLLECTION).updateOne).not.toHaveBeenCalled();
  });

  it('200 resends and appends an email_resent audit entry WITHOUT touching emailSentAt', async () => {
    const order = buildOrder();
    mockGetOrder.mockResolvedValueOnce(order);
    const res = await call(resendEmailPOST, 'ABCD1234', {});
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [order.email],
        subject: `Order confirmation #${order.orderId}`,
      }),
    );
    const [filter, update] = mongoMock.collection(ORDERS_COLLECTION).updateOne.mock.calls[0];
    expect(filter).toEqual({ orderId: 'ABCD1234' });
    expect(update.$push.auditLog).toMatchObject({ kind: 'email_resent', subject: 'order' });
    // The once-only marker stays owned by the original send path.
    expect(Object.keys(update.$set)).toEqual(['updatedAt']);
  });

  it('still returns 200 (email already sent) and reports to the error sink when the audit write throws', async () => {
    mockGetOrder.mockResolvedValueOnce(buildOrder());
    mongoMock
      .collection(ORDERS_COLLECTION)
      .updateOne.mockRejectedValueOnce(new Error('mongo down'));
    const res = await call(resendEmailPOST, 'ABCD1234', {});
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
  });
});

describe('POST /resend-shipment-email', () => {
  it('409 not-shipped when fulfillment is not currently shipped', async () => {
    mockGetOrder.mockResolvedValueOnce(buildOrder());
    const res = await call(resendShipmentPOST, 'ABCD1234', {});
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('not-shipped');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('404 when the order does not exist', async () => {
    mockGetOrder.mockResolvedValueOnce(null);
    const res = await call(resendShipmentPOST, 'ABCD1234', {});
    expect(res.status).toBe(404);
  });

  it('502 send-failed without an audit write', async () => {
    mockGetOrder.mockResolvedValueOnce(
      buildOrder({ fulfillment: { status: 'shipped', trackingNumber: 'AWB123' } }),
    );
    sendEmailMock.mockRejectedValueOnce(new Error('resend 500'));
    const res = await call(resendShipmentPOST, 'ABCD1234', {});
    expect(res.status).toBe(502);
    expect(mongoMock.collection(ORDERS_COLLECTION).updateOne).not.toHaveBeenCalled();
  });

  it('200 resends and audits WITHOUT touching the shipmentEmailSentAt idempotency marker', async () => {
    const order = buildOrder({
      fulfillment: {
        status: 'shipped',
        trackingNumber: 'AWB123',
        shipmentEmailSentAt: new Date('2026-06-02T00:00:00Z'),
      },
    });
    mockGetOrder.mockResolvedValueOnce(order);
    const res = await call(resendShipmentPOST, 'ABCD1234', {});
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [filter, update] = mongoMock.collection(ORDERS_COLLECTION).updateOne.mock.calls[0];
    expect(filter).toEqual({ orderId: 'ABCD1234' });
    expect(update.$push.auditLog).toMatchObject({ kind: 'email_resent', subject: 'shipment' });
    expect(Object.keys(update.$set)).toEqual(['updatedAt']);
    expect(JSON.stringify(update)).not.toContain('shipmentEmailSentAt');
  });

  it('still returns 200 (email already sent) and reports to the error sink when the audit write throws', async () => {
    mockGetOrder.mockResolvedValueOnce(
      buildOrder({ fulfillment: { status: 'shipped', trackingNumber: 'AWB123' } }),
    );
    mongoMock
      .collection(ORDERS_COLLECTION)
      .updateOne.mockRejectedValueOnce(new Error('mongo down'));
    const res = await call(resendShipmentPOST, 'ABCD1234', {});
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
  });
});
