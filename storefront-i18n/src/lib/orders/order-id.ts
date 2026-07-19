/**
 * Order id generation + the uniqueness machinery behind it (issue #15).
 *
 * Invariants:
 *   - `generateOrderId` keeps the historical 8-hex-uppercase format — admin,
 *     emails, confirmation URLs and the Meta CAPI event_id all display it.
 *   - `orders.orderId` carries a unique index; ids are random (4 bytes), so a
 *     birthday collision is possible and must be rejected by the DB, never
 *     silently merged into another customer's order.
 * Side effects: `ensureOrderIdIndex` creates the unique index once per process.
 * Caller contract: order INSERTS must go through `saveOrder` (lib/contacts.ts),
 * which ensures the index and regenerates the id on a duplicate-key error.
 */
import crypto from 'crypto';
import { getDb } from '@/lib/mongodb';
import { captureError } from '@/lib/error-sink';

const ORDERS_COLLECTION = 'orders';

/** Total insert attempts before a duplicate-key error is allowed to bubble. */
export const ORDER_ID_INSERT_MAX_ATTEMPTS = 3;

export function generateOrderId(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

let indexEnsured = false;

/**
 * Ensure the unique index on `orders.orderId`, once per process (same pattern
 * as webhook-inbox / account-tokens). Creation failure must never block order
 * writes — a legacy DB with pre-existing duplicate ids stays degraded (no
 * collision guard) but keeps accepting orders. The failure is surfaced to the
 * error sink and `indexEnsured` stays false so the next write retries.
 */
export async function ensureOrderIdIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = await getDb();
  try {
    await db.collection(ORDERS_COLLECTION).createIndex({ orderId: 1 }, { unique: true });
    indexEnsured = true;
  } catch (err) {
    captureError(err, { collection: ORDERS_COLLECTION }, { tag: 'order_id_index' });
  }
}

/** Mongo duplicate-key error (code 11000) — the unique index rejecting an insert. */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000
  );
}
