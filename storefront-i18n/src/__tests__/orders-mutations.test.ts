import { describe, expect, it, vi } from 'vitest';
// Shared mock library + builders (issue #20) — see src/__tests__/helpers/.
import { mongoMock } from './helpers/mongodb.mock';
import { buildShipping } from './helpers/builders';

vi.mock('@/lib/mongodb', () => mongoMock.module());

vi.mock('@/plugins/abandoned-cart/config', () => ({
  isAbandonedCartDryRun: () => false,
}));

import {
  appendNote,
  editShipping,
  markReviewEmailFailed,
  markReviewEmailSent,
  recordRefund,
  setFulfillment,
  transitionStatus,
} from '@/lib/orders/mutations';
import { ALLOWED_FROM } from '@/lib/orders/status-machine';
import { ORDERS_COLLECTION } from '@/lib/orders/types';

const orders = () => mongoMock.collection(ORDERS_COLLECTION);
const baseShipping = buildShipping();

describe('transitionStatus', () => {
  it('uses an aggregation pipeline and a status:$in filter scoped to ALLOWED_FROM', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      auditLog: [{ kind: 'status', from: 'received', to: 'paid', at: new Date() }],
    });
    const result = await transitionStatus('X', 'paid');
    expect(result).toMatchObject({ ok: true, from: 'received' });

    expect(orders().findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = orders().findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ orderId: 'X' });
    // Filter enforces legality atomically — no read-then-write.
    const inSet = (filter as { status: { $in: string[] } }).status.$in;
    expect(new Set(inSet)).toEqual(new Set(ALLOWED_FROM.paid));
    // Aggregation-pipeline form (array of stages, not a $set object).
    expect(Array.isArray(update)).toBe(true);
    const setStage = (update as Array<Record<string, unknown>>)[0].$set as Record<string, unknown>;
    // Audit entry references the prior $status before the overwrite.
    expect(JSON.stringify(setStage.auditLog)).toContain('"$status"');
    expect(setStage.status).toBe('paid');
  });

  it('returns illegal-transition when filter does not match and order exists', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce(null);
    orders().findOne.mockResolvedValueOnce({ orderId: 'X', status: 'cancelled' });
    const result = await transitionStatus('X', 'paid');
    expect(result).toEqual({ ok: false, reason: 'illegal-transition' });
  });

  it('returns not-found when order does not exist', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce(null);
    orders().findOne.mockResolvedValueOnce(null);
    const result = await transitionStatus('X', 'paid');
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });
});

describe('appendNote', () => {
  it('pushes the note and a matching audit entry in one updateOne', async () => {
    orders().updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    const result = await appendNote('X', '  customer rang back  ');
    expect(result).toEqual({ ok: true });
    const [, update] = orders().updateOne.mock.calls[0];
    const push = (update as { $push: Record<string, unknown> }).$push;
    expect((push.notes as { body: string }).body).toBe('customer rang back');
    expect((push.auditLog as { kind: string }).kind).toBe('note');
  });

  it('returns not-found when no doc matches', async () => {
    orders().updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    const result = await appendNote('X', 'note');
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });
});

describe('setFulfillment', () => {
  it('flags needsShipmentEmail when result is shipped+tracking and email not yet sent', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: { status: 'shipped', trackingNumber: 'AWB1' },
    });
    const result = await setFulfillment('X', { status: 'shipped', trackingNumber: 'AWB1' });
    expect(result).toMatchObject({ ok: true, needsShipmentEmail: true });
  });

  it('does NOT re-flag when shipmentEmailSentAt is already populated', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: {
        status: 'shipped',
        trackingNumber: 'AWB1',
        shipmentEmailSentAt: new Date(),
      },
    });
    const result = await setFulfillment('X', { trackingNumber: 'AWB2' });
    expect(result).toMatchObject({ ok: true, needsShipmentEmail: false });
  });

  it('refuses on terminal statuses', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce(null);
    orders().findOne.mockResolvedValueOnce({ orderId: 'X', status: 'cancelled' });
    const result = await setFulfillment('X', { status: 'shipped' });
    expect(result).toEqual({ ok: false, reason: 'terminal-status' });
  });

  it('filter excludes terminal statuses ($nin guard)', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: { status: 'unfulfilled' },
    });
    await setFulfillment('X', { status: 'unfulfilled' });
    const [filter] = orders().findOneAndUpdate.mock.calls[0];
    const nin = (filter as { status: { $nin: string[] } }).status.$nin;
    expect(new Set(nin)).toEqual(new Set(['cancelled', 'refunded']));
  });
});

describe('markReviewEmailSent', () => {
  it('sets reviewEmailSentAt + reviewEmailLastAttemptAt and clears reviewEmailLastError', async () => {
    orders().updateOne.mockResolvedValueOnce({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
    const at = new Date('2026-07-05T10:00:00.000Z');
    await markReviewEmailSent('X', at);

    const [filter, update] = orders().updateOne.mock.calls[0];
    expect(filter).toEqual({ orderId: 'X' });
    expect((update as { $set: Record<string, unknown> }).$set).toMatchObject({
      'fulfillment.reviewEmailSentAt': at,
      'fulfillment.reviewEmailLastAttemptAt': at,
    });
    expect((update as { $unset: Record<string, unknown> }).$unset).toEqual({
      'fulfillment.reviewEmailLastError': '',
    });
  });
});

describe('markReviewEmailFailed', () => {
  it('records the error + attempt timestamp without touching reviewEmailSentAt (retry stays possible)', async () => {
    orders().updateOne.mockResolvedValueOnce({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
    const at = new Date('2026-07-05T10:00:00.000Z');
    await markReviewEmailFailed('X', 'Resend down', at);

    const [filter, update] = orders().updateOne.mock.calls[0];
    expect(filter).toEqual({ orderId: 'X' });
    const set = (update as { $set: Record<string, unknown> }).$set;
    expect(set['fulfillment.reviewEmailLastError']).toBe('Resend down');
    expect(set['fulfillment.reviewEmailLastAttemptAt']).toEqual(at);
    expect(set).not.toHaveProperty('fulfillment.reviewEmailSentAt');
  });

  it('truncates the error message to 1000 chars', async () => {
    orders().updateOne.mockResolvedValueOnce({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
    await markReviewEmailFailed('X', 'x'.repeat(2000), new Date());
    const [, update] = orders().updateOne.mock.calls[0];
    const message = (update as { $set: Record<string, unknown> }).$set[
      'fulfillment.reviewEmailLastError'
    ] as string;
    expect(message.length).toBe(1000);
  });
});

describe('recordRefund', () => {
  it('rejects non-positive amounts', async () => {
    expect(await recordRefund('X', { amount: 0 })).toEqual({
      ok: false,
      reason: 'invalid-amount',
    });
    expect(await recordRefund('X', { amount: -1 })).toEqual({
      ok: false,
      reason: 'invalid-amount',
    });
  });

  it('rejects when a refund is already recorded', async () => {
    orders().findOne.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      totalPrice: 1000,
      refund: { amount: 500, refundedAt: new Date() },
    });
    expect(await recordRefund('X', { amount: 100 })).toEqual({
      ok: false,
      reason: 'already-refunded',
    });
  });

  it('rejects when amount > totalPrice', async () => {
    orders().findOne.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      totalPrice: 100,
    });
    expect(await recordRefund('X', { amount: 200 })).toEqual({
      ok: false,
      reason: 'invalid-amount',
    });
  });

  it('rejects illegal transitions (e.g. from cancelled)', async () => {
    orders().findOne.mockResolvedValueOnce({
      orderId: 'X',
      status: 'cancelled',
      totalPrice: 1000,
    });
    expect(await recordRefund('X', { amount: 100 })).toEqual({
      ok: false,
      reason: 'illegal-transition',
    });
  });

  it('happy path: writes refund + status pipeline', async () => {
    orders().findOne.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      totalPrice: 1000,
    });
    orders().findOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'refunded',
      refund: { amount: 100, refundedAt: new Date() },
    });
    const result = await recordRefund('X', { amount: 100, reason: 'damaged' });
    expect(result).toMatchObject({ ok: true });
    const [, update] = orders().findOneAndUpdate.mock.calls[0];
    expect(Array.isArray(update)).toBe(true);
    const setStage = (update as Array<Record<string, unknown>>)[0].$set as Record<string, unknown>;
    expect(setStage.status).toBe('refunded');
    // Audit captures from:$status atomically.
    expect(JSON.stringify(setStage.auditLog)).toContain('"$status"');
  });
});

describe('editShipping', () => {
  it('uses pipeline form to snapshot prior $shipping atomically', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      shipping: baseShipping,
    });
    const result = await editShipping('X', { ...baseShipping, city: 'Cluj' });
    expect(result).toMatchObject({ ok: true });
    const [filter, update] = orders().findOneAndUpdate.mock.calls[0];
    const nin = (filter as { status: { $nin: string[] } }).status.$nin;
    expect(new Set(nin)).toEqual(new Set(['cancelled', 'refunded']));
    expect(Array.isArray(update)).toBe(true);
    const setStage = (update as Array<Record<string, unknown>>)[0].$set as Record<string, unknown>;
    expect(JSON.stringify(setStage.auditLog)).toContain('"$shipping"');
  });

  it('refuses on terminal statuses', async () => {
    orders().findOneAndUpdate.mockResolvedValueOnce(null);
    orders().findOne.mockResolvedValueOnce({ orderId: 'X', status: 'refunded' });
    expect(await editShipping('X', baseShipping)).toEqual({
      ok: false,
      reason: 'terminal-status',
    });
  });
});
