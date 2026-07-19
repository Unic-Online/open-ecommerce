/**
 * Recovery-coupon issuance + atomic redemption.
 *
 * Invariants:
 *   - One redemption per coupon (`maxUses: 1`); guaranteed at-most-once via `findOneAndUpdate` with `usedCount: 0` filter.
 *   - Codes are uppercase on storage and lookup; alphabet excludes 0/O/1/I/L for human copy/paste.
 *   - `code` is the Mongo unique index — collision triggers an in-loop retry (5 attempts), not a thrown error.
 *   - `validateCoupon` is read-only; `redeemCoupon` is the only path that decrements `usedCount`.
 * Side effects: writes to `cart_coupons` collection.
 * Caller contract: order routes MUST `redeemCoupon` BEFORE applying the discount to the order total — `validateCoupon` is for UI hints only.
 */
import crypto from 'crypto';
import { getDb } from '@/lib/mongodb';
import { commerce } from '@/site.config';
import {
  COUPONS_COLLECTION,
  type CouponDoc,
} from '../shared/types';

const COUPON_VALIDITY_DAYS = 7;
const COUPON_PREFIX = commerce.couponPrefix;
// Avoid 0/O and 1/I/L to make codes copy/paste-friendly.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let indexesEnsured = false;

async function ensureIndexes() {
  if (indexesEnsured) return;
  const db = await getDb();
  const c = db.collection<CouponDoc>(COUPONS_COLLECTION);
  await c.createIndex({ code: 1 }, { unique: true });
  await c.createIndex({ cartId: 1 });
  await c.createIndex({ email: 1 });
  await c.createIndex({ validUntil: 1 });
  indexesEnsured = true;
}

function randomBlock(len: number): string {
  const buf = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

export function generateCouponCode(): string {
  return `${COUPON_PREFIX}-${randomBlock(4)}-${randomBlock(4)}`;
}

export interface IssueCouponArgs {
  cartId: string;
  email: string;
  discountPercent: number;
  validForDays?: number;
}

export async function issueCoupon(args: IssueCouponArgs): Promise<CouponDoc> {
  await ensureIndexes();
  const db = await getDb();
  const c = db.collection<CouponDoc>(COUPONS_COLLECTION);
  const now = new Date();
  const validUntil = new Date(
    now.getTime() + (args.validForDays ?? COUPON_VALIDITY_DAYS) * 24 * 60 * 60 * 1000,
  );

  // Five attempts to handle the (vanishingly rare) collision case.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCouponCode();
    try {
      const doc: CouponDoc = {
        code,
        cartId: args.cartId,
        email: args.email.trim().toLowerCase(),
        discountPercent: args.discountPercent,
        maxUses: 1,
        usedCount: 0,
        validFrom: now,
        validUntil,
        createdAt: now,
      };
      await c.insertOne(doc);
      return doc;
    } catch (err: unknown) {
      // Duplicate code (very unlikely with our alphabet × length) — retry.
      const errMsg = String(err);
      if (errMsg.includes('E11000') || errMsg.includes('duplicate key')) continue;
      throw err;
    }
  }
  throw new Error('coupon: failed to generate a unique code after retries');
}

export interface ValidationOk {
  valid: true;
  discountPercent: number;
  validUntil: Date;
  email: string;
}
export interface ValidationFailure {
  valid: false;
  reason: 'unknown-code' | 'expired' | 'already-used' | 'wrong-email';
}
export type CouponValidation = ValidationOk | ValidationFailure;

/**
 * Validate without redeeming. Used by /api/cart/apply-coupon to populate the
 * UI with the discount % the user qualifies for. The order route re-validates
 * and atomically redeems at submission time.
 */
export async function validateCoupon(
  code: string,
  email: string,
): Promise<CouponValidation> {
  await ensureIndexes();
  const db = await getDb();
  const c = db.collection<CouponDoc>(COUPONS_COLLECTION);
  const coupon = await c.findOne({ code: code.trim().toUpperCase() });
  if (!coupon) return { valid: false, reason: 'unknown-code' };
  if (coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: 'already-used' };
  }
  if (coupon.validUntil.getTime() < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  if (coupon.email !== email.trim().toLowerCase()) {
    return { valid: false, reason: 'wrong-email' };
  }
  return {
    valid: true,
    discountPercent: coupon.discountPercent,
    validUntil: coupon.validUntil,
    email: coupon.email,
  };
}

/**
 * Atomic redemption — guaranteed at-most-once via the filter on
 * `usedCount: 0`. Returns the redeemed coupon, or null if redemption failed
 * (already used, expired, wrong email, or unknown code).
 */
export async function redeemCoupon(args: {
  code: string;
  email: string;
  orderId: string;
}): Promise<CouponDoc | null> {
  await ensureIndexes();
  const db = await getDb();
  const c = db.collection<CouponDoc>(COUPONS_COLLECTION);
  const now = new Date();
  const result = await c.findOneAndUpdate(
    {
      code: args.code.trim().toUpperCase(),
      email: args.email.trim().toLowerCase(),
      usedCount: 0,
      validUntil: { $gt: now },
    },
    {
      $set: {
        redeemedAt: now,
        redeemedOrderId: args.orderId,
      },
      $inc: { usedCount: 1 },
    },
    { returnDocument: 'after' },
  );
  return result ?? null;
}
