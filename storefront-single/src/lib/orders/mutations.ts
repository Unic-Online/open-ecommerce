/**
 * Server-only mutations on the orders collection. Every write goes through
 * here — no admin route handler hits Mongo directly.
 *
 * Invariants:
 *   - All updates are single `findOneAndUpdate` calls with the legality check
 *     baked into the filter — never read-then-write (would race with the
 *     Revolut webhook).
 *   - Mutations that need to capture a prior field value (status, shipping)
 *     use the aggregation-pipeline form so the audit entry can reference
 *     `$status` / `$shipping` BEFORE the overwrite, atomically.
 *   - Dry-run short-circuits (mirrors abandoned-cart admin pages). When
 *     `isAbandonedCartDryRun()` is true, every function returns
 *     `{ ok: false, reason: 'dry-run' }` (transitionStatus) or `{ ok: false }`
 *     for the others, without touching the DB.
 *   - Terminal-state guards (`cancelled` / `refunded`) live in two places:
 *     here, in the `$nin` filters of fulfillment / shipping edits; and in
 *     `updateOrderPayment`, so the webhook can't overwrite an admin terminal
 *     state either.
 *   - `setFulfillment` returns `needsShipmentEmail: true` ONLY when the
 *     resulting state has `status: 'shipped'` AND a non-empty `trackingNumber`
 *     AND `shipmentEmailSentAt` is currently absent. The route handler is
 *     responsible for the actual send + the follow-up
 *     `markShipmentEmailSent`/`markShipmentEmailFailed`. This keeps the DB
 *     write atomic and the email failure path observable.
 * Side effects: writes to `orders` collection.
 * Caller contract: route handlers MUST translate the result into an HTTP
 *   status — `ok: false, reason: 'illegal-transition' | 'terminal-status'` →
 *   409 Conflict; `not-found` → 404; `dry-run` → 200 with a dry-run flag.
 */
import { getDb } from '@/lib/mongodb';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import type { ShippingData } from '@/lib/validation';
import {
  ALLOWED_FROM,
  TERMINAL_STATUSES,
  type OrderStatus,
} from './status-machine';
import {
  ORDERS_COLLECTION,
  type Fulfillment,
  type OrderDoc,
  type Refund,
} from './types';

const TERMINAL_LIST: OrderStatus[] = Array.from(TERMINAL_STATUSES);

export type TransitionResult =
  | { ok: true; from: OrderStatus; order: OrderDoc }
  | { ok: false; reason: 'illegal-transition' | 'not-found' | 'dry-run' };

/**
 * Move an order to `to`. Filter enforces legality via `status: { $in: ALLOWED_FROM[to] }`,
 * so the entire (legality check + audit append + status overwrite) is one
 * atomic Mongo op. Pipeline form because the audit entry needs the prior
 * `$status` value before the overwrite.
 */
export async function transitionStatus(
  orderId: string,
  to: OrderStatus,
): Promise<TransitionResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };

  const allowedFrom = ALLOWED_FROM[to];
  if (allowedFrom.length === 0) {
    // Terminal `to`s with no legal `from` (none today, but defensive).
    return { ok: false, reason: 'illegal-transition' };
  }

  const db = await getDb();
  const c = db.collection<OrderDoc>(ORDERS_COLLECTION);
  const result = await c.findOneAndUpdate(
    { orderId, status: { $in: allowedFrom } as unknown as OrderStatus },
    [
      {
        $set: {
          auditLog: {
            $concatArrays: [
              { $ifNull: ['$auditLog', []] },
              [{ kind: 'status', from: '$status', to, at: '$$NOW' }],
            ],
          },
          status: to,
          updatedAt: '$$NOW',
        },
      },
    ],
    { returnDocument: 'after' },
  );

  if (!result) {
    // Either the order doesn't exist or the current status isn't in
    // `allowedFrom`. Disambiguate with a cheap second read.
    const existing = await c.findOne({ orderId });
    if (!existing) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'illegal-transition' };
  }

  const updated = result as unknown as OrderDoc;
  // The audit entry we just appended carries the prior `from` value.
  const lastAudit = updated.auditLog?.[updated.auditLog.length - 1];
  const from =
    lastAudit && lastAudit.kind === 'status' ? lastAudit.from : updated.status;
  return { ok: true, from, order: updated };
}

export type AppendNoteResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'dry-run' };

export async function appendNote(orderId: string, body: string): Promise<AppendNoteResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, reason: 'not-found' };
  const at = new Date();
  const db = await getDb();
  const c = db.collection<OrderDoc>(ORDERS_COLLECTION);
  const result = await c.updateOne(
    { orderId },
    {
      $push: {
        notes: { body: trimmed, createdAt: at },
        auditLog: { kind: 'note', body: trimmed, at },
      },
      $set: { updatedAt: at },
    },
  );
  if (result.matchedCount === 0) return { ok: false, reason: 'not-found' };
  return { ok: true };
}

export type SetFulfillmentResult =
  | {
      ok: true;
      needsShipmentEmail: boolean;
      order: OrderDoc;
    }
  | { ok: false; reason: 'not-found' | 'terminal-status' | 'dry-run' };

/**
 * Patch fulfillment fields on the order. Refuses on terminal statuses.
 * Returns `needsShipmentEmail: true` when the resulting fulfillment state
 * is `shipped` with a tracking number and the shipment email has not yet
 * been sent — the caller (route handler) is responsible for sending and
 * then calling `markShipmentEmailSent`.
 */
export async function setFulfillment(
  orderId: string,
  patch: Partial<Fulfillment>,
): Promise<SetFulfillmentResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };

  const at = new Date();
  const set: Record<string, unknown> = { updatedAt: at };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) set[`fulfillment.${k}`] = v;
  }
  if (patch.status === 'shipped' && !patch.shippedAt) {
    set['fulfillment.shippedAt'] = at;
  }
  if (patch.status === 'delivered' && !patch.deliveredAt) {
    set['fulfillment.deliveredAt'] = at;
  }

  const db = await getDb();
  const c = db.collection<OrderDoc>(ORDERS_COLLECTION);
  const result = await c.findOneAndUpdate(
    { orderId, status: { $nin: TERMINAL_LIST } },
    {
      $set: set,
      $push: {
        auditLog: { kind: 'fulfillment', patch, at },
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    const existing = await c.findOne({ orderId });
    if (!existing) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'terminal-status' };
  }

  const updated = result as unknown as OrderDoc;
  const tracking = updated.fulfillment?.trackingNumber?.trim();
  const needsShipmentEmail =
    updated.fulfillment?.status === 'shipped' &&
    !!tracking &&
    !updated.fulfillment?.shipmentEmailSentAt;

  return { ok: true, needsShipmentEmail, order: updated };
}

export async function markShipmentEmailSent(orderId: string, at: Date): Promise<void> {
  if (isAbandonedCartDryRun()) return;
  const db = await getDb();
  await db.collection<OrderDoc>(ORDERS_COLLECTION).updateOne(
    { orderId },
    {
      $set: {
        'fulfillment.shipmentEmailSentAt': at,
        'fulfillment.shipmentEmailLastAttemptAt': at,
        updatedAt: at,
      },
      $unset: { 'fulfillment.shipmentEmailLastError': '' },
    },
  );
}

export async function markShipmentEmailFailed(
  orderId: string,
  error: string,
  at: Date,
): Promise<void> {
  if (isAbandonedCartDryRun()) return;
  const db = await getDb();
  await db.collection<OrderDoc>(ORDERS_COLLECTION).updateOne(
    { orderId },
    {
      $set: {
        'fulfillment.shipmentEmailLastError': error.slice(0, 1000),
        'fulfillment.shipmentEmailLastAttemptAt': at,
        updatedAt: at,
      },
    },
  );
}

export async function markReviewEmailSent(orderId: string, at: Date): Promise<void> {
  if (isAbandonedCartDryRun()) return;
  const db = await getDb();
  await db.collection<OrderDoc>(ORDERS_COLLECTION).updateOne(
    { orderId },
    {
      $set: {
        'fulfillment.reviewEmailSentAt': at,
        'fulfillment.reviewEmailLastAttemptAt': at,
        updatedAt: at,
      },
      $unset: { 'fulfillment.reviewEmailLastError': '' },
    },
  );
}

export async function markReviewEmailFailed(
  orderId: string,
  error: string,
  at: Date,
): Promise<void> {
  if (isAbandonedCartDryRun()) return;
  const db = await getDb();
  await db.collection<OrderDoc>(ORDERS_COLLECTION).updateOne(
    { orderId },
    {
      $set: {
        'fulfillment.reviewEmailLastError': error.slice(0, 1000),
        'fulfillment.reviewEmailLastAttemptAt': at,
        updatedAt: at,
      },
    },
  );
}

export type RecordRefundResult =
  | { ok: true; order: OrderDoc }
  | {
      ok: false;
      reason:
        | 'not-found'
        | 'already-refunded'
        | 'invalid-amount'
        | 'illegal-transition'
        | 'dry-run';
    };

/**
 * Record a manual refund and atomically transition status to 'refunded'.
 * Refuses if a refund is already recorded, the amount is non-positive, or
 * exceeds totalPrice. The transition itself is gated by ALLOWED_FROM['refunded'].
 */
export async function recordRefund(
  orderId: string,
  refund: Omit<Refund, 'refundedAt'>,
): Promise<RecordRefundResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };
  if (!Number.isFinite(refund.amount) || refund.amount <= 0) {
    return { ok: false, reason: 'invalid-amount' };
  }

  const db = await getDb();
  const c = db.collection<OrderDoc>(ORDERS_COLLECTION);
  const existing = await c.findOne({ orderId });
  if (!existing) return { ok: false, reason: 'not-found' };
  if (existing.refund) return { ok: false, reason: 'already-refunded' };
  if (refund.amount > (existing.totalPrice as number)) {
    return { ok: false, reason: 'invalid-amount' };
  }
  if (!ALLOWED_FROM.refunded.includes(existing.status as OrderStatus)) {
    return { ok: false, reason: 'illegal-transition' };
  }

  const refundDoc: Refund = {
    amount: refund.amount,
    reason: refund.reason,
    reference: refund.reference,
    refundedAt: new Date(),
  };

  // Pipeline so audit captures prior status atomically.
  const result = await c.findOneAndUpdate(
    {
      orderId,
      refund: { $exists: false },
      status: { $in: ALLOWED_FROM.refunded as unknown as OrderStatus[] },
    },
    [
      {
        $set: {
          auditLog: {
            $concatArrays: [
              { $ifNull: ['$auditLog', []] },
              [
                { kind: 'status', from: '$status', to: 'refunded', at: '$$NOW' },
                {
                  kind: 'refund',
                  amount: refund.amount,
                  reference: refund.reference ?? null,
                  at: '$$NOW',
                },
              ],
            ],
          },
          status: 'refunded',
          refund: refundDoc,
          updatedAt: '$$NOW',
        },
      },
    ],
    { returnDocument: 'after' },
  );

  if (!result) {
    // Lost a race — re-classify.
    const fresh = await c.findOne({ orderId });
    if (!fresh) return { ok: false, reason: 'not-found' };
    if (fresh.refund) return { ok: false, reason: 'already-refunded' };
    return { ok: false, reason: 'illegal-transition' };
  }

  return { ok: true, order: result as unknown as OrderDoc };
}

export type EditShippingResult =
  | { ok: true; order: OrderDoc }
  | { ok: false; reason: 'not-found' | 'terminal-status' | 'dry-run' };

/**
 * Replace the shipping object wholesale. Refuses on terminal statuses
 * (cancelled / refunded). Pipeline form so the audit entry snapshots the
 * prior shipping object atomically.
 */
export async function editShipping(
  orderId: string,
  shipping: ShippingData,
): Promise<EditShippingResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };

  const db = await getDb();
  const c = db.collection<OrderDoc>(ORDERS_COLLECTION);

  const result = await c.findOneAndUpdate(
    { orderId, status: { $nin: TERMINAL_LIST } },
    [
      {
        $set: {
          auditLog: {
            $concatArrays: [
              { $ifNull: ['$auditLog', []] },
              [{ kind: 'shipping_edit', prevShipping: '$shipping', at: '$$NOW' }],
            ],
          },
          shipping,
          updatedAt: '$$NOW',
        },
      },
    ],
    { returnDocument: 'after' },
  );

  if (!result) {
    const existing = await c.findOne({ orderId });
    if (!existing) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'terminal-status' };
  }
  return { ok: true, order: result as unknown as OrderDoc };
}
