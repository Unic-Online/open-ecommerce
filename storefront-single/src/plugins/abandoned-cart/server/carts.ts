import { randomUUID } from 'crypto';
import { getDb } from '@/lib/mongodb';
import type { CartItemData } from '@/lib/types';
import type { MarketKey } from '@/lib/market';
import {
  CARTS_COLLECTION,
  type CartDoc,
  type CartStatus,
} from '../shared/types';

let indexesEnsured = false;

async function ensureIndexes() {
  if (indexesEnsured) return;
  const db = await getDb();
  const c = db.collection<CartDoc>(CARTS_COLLECTION);
  // Index creation is idempotent — MongoDB no-ops if the index exists.
  await c.createIndex({ cartId: 1 }, { unique: true });
  await c.createIndex({ email: 1 });
  // Compound index serves the recovery cron's filter shape.
  await c.createIndex({
    status: 1,
    recoveryStep: 1,
    abandonedAt: 1,
  });
  await c.createIndex({ lastActivityAt: 1 });
  indexesEnsured = true;
}

export function generateCartId(): string {
  return randomUUID();
}

export interface UpsertCartArgs {
  cartId: string;
  items: CartItemData[];
  subtotal: number;
  email?: string;
  phone?: string;
  marketingConsent: boolean;
  ipAddress?: string;
  userAgent?: string;
  market?: MarketKey;
}

export interface UpsertCartResult {
  cartId: string;
  rotated: boolean;
}

/**
 * Idempotent upsert keyed by cartId.
 *
 * Status transitions:
 *   - any → 'active'    when items.length > 0 (and cart isn't completed)
 *   - existing non-completed → 'recovered' when items.length === 0 AND
 *     recoveryEmails has been sent (user emptied after we contacted them)
 *   - empty + no existing doc → no-op (no insert)
 *   - empty + existing 'completed' → no-op (no rotation)
 *
 * Invariants:
 *   - 'completed' carts are immutable (order-linked). When the input cartId
 *     resolves to a completed doc with non-empty items, this function rotates:
 *     it generates a fresh cartId and inserts a clean new doc. Empty syncs
 *     against a completed cart never rotate — that path used to mint a noise
 *     'recovered' doc with no items.
 *   - Empty syncs never create new docs. Pre-fix this minted thousands of
 *     status:'recovered' rows that the recovery cron skipped (it filters on
 *     `'items.0': { $exists: true }`), polluting dashboards.
 *   - Without rotation, the prior `{ status: { $nin: ['completed'] } }` filter
 *     combined with `upsert: true` collided with the `cartId` unique index
 *     (E11000), silently 500ing the sync route and locking returning
 *     customers out of the recovery funnel.
 *
 * Side effects: writes to `carts` collection.
 */
export async function upsertCart(args: UpsertCartArgs): Promise<UpsertCartResult> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const c = db.collection<CartDoc>(CARTS_COLLECTION);

  const existing = await c.findOne({ cartId: args.cartId });

  // Why: empty syncs (post-purchase clear, contact-only checkout typing) used
  // to mint 'recovered' docs that never went through the funnel — pure noise
  // in dashboards. Don't insert anything for empty carts; only update an
  // existing non-completed doc, and only flip it to 'recovered' when the
  // recovery cron has actually emailed the user.
  if (args.items.length === 0) {
    if (!existing || existing.status === 'completed') {
      return { cartId: args.cartId, rotated: false };
    }
    const wasContacted = (existing.recoveryEmails?.length ?? 0) > 0;
    const set: Record<string, unknown> = {
      items: args.items,
      subtotal: args.subtotal,
      marketingConsent: args.marketingConsent,
      lastActivityAt: now,
    };
    if (wasContacted) {
      set.status = 'recovered';
      set.recoveredAt = now;
    }
    if (args.market) set.market = args.market;
    if (args.email) set.email = args.email.trim().toLowerCase();
    if (args.phone) set.phone = args.phone.trim();
    if (args.ipAddress) set.ipAddress = args.ipAddress;
    if (args.userAgent) set.userAgent = args.userAgent.slice(0, 2048);

    await c.updateOne(
      { cartId: args.cartId, status: { $nin: ['completed'] } },
      { $set: set },
    );
    return { cartId: args.cartId, rotated: false };
  }

  const status: CartStatus = 'active';

  if (existing?.status === 'completed') {
    // Rotate: insert a fresh doc with a new cartId. Old completed doc stays.
    const newCartId = generateCartId();
    const fresh: CartDoc = {
      cartId: newCartId,
      items: args.items,
      subtotal: args.subtotal,
      marketingConsent: args.marketingConsent,
      status,
      recoveryStep: 0,
      recoveryEmails: [],
      createdAt: now,
      lastActivityAt: now,
    };
    if (args.market) fresh.market = args.market;
    if (args.email) fresh.email = args.email.trim().toLowerCase();
    if (args.phone) fresh.phone = args.phone.trim();
    if (args.ipAddress) fresh.ipAddress = args.ipAddress;
    if (args.userAgent) fresh.userAgent = args.userAgent.slice(0, 2048);

    await c.insertOne(fresh);
    return { cartId: newCartId, rotated: true };
  }

  const set: Record<string, unknown> = {
    items: args.items,
    subtotal: args.subtotal,
    marketingConsent: args.marketingConsent,
    lastActivityAt: now,
    status,
  };
  if (args.market) set.market = args.market;
  if (args.email) set.email = args.email.trim().toLowerCase();
  if (args.phone) set.phone = args.phone.trim();
  if (args.ipAddress) set.ipAddress = args.ipAddress;
  if (args.userAgent) set.userAgent = args.userAgent.slice(0, 2048);

  await c.updateOne(
    {
      cartId: args.cartId,
      status: { $nin: ['completed'] },
    },
    {
      $set: set,
      $setOnInsert: {
        cartId: args.cartId,
        createdAt: now,
        recoveryStep: 0,
        recoveryEmails: [],
      },
    },
    { upsert: true },
  );

  return { cartId: args.cartId, rotated: false };
}

export async function findCart(cartId: string): Promise<CartDoc | null> {
  await ensureIndexes();
  const db = await getDb();
  return db.collection<CartDoc>(CARTS_COLLECTION).findOne({ cartId });
}

export interface MarkCompletedArgs {
  cartId: string;
  orderId: string;
}

/**
 * Mark a cart as completed (an order was placed against it). Idempotent;
 * subsequent calls are no-ops. Suppresses all future recovery emails.
 */
export async function markCartCompleted(args: MarkCompletedArgs): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<CartDoc>(CARTS_COLLECTION).updateOne(
    { cartId: args.cartId },
    {
      $set: {
        status: 'completed',
        completedAt: now,
        orderId: args.orderId,
        lastActivityAt: now,
      },
    },
  );
}
