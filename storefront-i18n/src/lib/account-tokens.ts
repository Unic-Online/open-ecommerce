/**
 * Account magic-link nonce store + per-email rate limiter (Mongo-backed).
 *
 * Invariants:
 *   - `account_login_tokens` is single-use: `consumeToken(nonce)` is atomic
 *     (`findOneAndDelete`); a 0-doc result means the nonce was never issued
 *     or has already been consumed (replay).
 *   - `account_login_attempts` is append-only with a TTL index of 1 hour.
 *     `countRecentRequests(email)` reads the rolling window; the route handler
 *     gates >3 → 429.
 * Side effects: reads/writes MongoDB.
 * Caller contract:
 *   - `recordIssuedToken` MUST be called before the magic-link email is sent.
 *   - `consumeToken` MUST be called by the verify route before issuing the session.
 *   - `recordRequest` MUST be called for every POST /api/account/request-link
 *     attempt (rate-limit accounting), regardless of whether an email is sent.
 *   - `countOrdersByEmail` is the only check that prevents enumeration: callers
 *     must always return ok:true to the user even when count is 0.
 */
import crypto from 'crypto';
import type { Document } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import {
  createMagicLinkToken,
  isAccountAuthConfigured,
  MAGIC_LINK_LONG_TTL_MS,
  type MagicLinkLocale,
} from '@/lib/account-auth';

interface AccountLoginTokenDoc extends Document {
  nonce: string;
  email: string;
  expiresAt: Date;
}

interface AccountLoginAttemptDoc extends Document {
  email: string;
  attemptedAt: Date;
}

let collectionsReady = false;

async function ensureIndexes(): Promise<void> {
  if (collectionsReady) return;
  const db = await getDb();
  await Promise.all([
    db.collection<AccountLoginTokenDoc>('account_login_tokens').createIndex(
      { nonce: 1 },
      { unique: true },
    ),
    db.collection<AccountLoginTokenDoc>('account_login_tokens').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ),
    db.collection<AccountLoginAttemptDoc>('account_login_attempts').createIndex(
      { email: 1, attemptedAt: -1 },
    ),
    db.collection<AccountLoginAttemptDoc>('account_login_attempts').createIndex(
      { attemptedAt: 1 },
      { expireAfterSeconds: 60 * 60 },
    ),
  ]);
  collectionsReady = true;
}

export async function recordIssuedToken(
  nonce: string,
  email: string,
  expiresAt: Date,
): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  await db
    .collection<AccountLoginTokenDoc>('account_login_tokens')
    .insertOne({ nonce, email: email.toLowerCase(), expiresAt });
}

export async function consumeToken(
  nonce: string,
): Promise<{ email: string } | null> {
  const db = await getDb();
  const doc = await db
    .collection<AccountLoginTokenDoc>('account_login_tokens')
    .findOneAndDelete({ nonce });
  if (!doc) return null;
  if (doc.expiresAt.getTime() <= Date.now()) return null;
  return { email: doc.email };
}

export async function recordRequest(email: string): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  await db
    .collection<AccountLoginAttemptDoc>('account_login_attempts')
    .insertOne({ email: email.toLowerCase(), attemptedAt: new Date() });
}

export async function countRecentRequests(
  email: string,
  withinMs = 60 * 60 * 1000,
): Promise<number> {
  const db = await getDb();
  return db
    .collection<AccountLoginAttemptDoc>('account_login_attempts')
    .countDocuments({
      email: email.toLowerCase(),
      attemptedAt: { $gte: new Date(Date.now() - withinMs) },
    });
}

/** Returns the number of orders associated with a given email (case-insensitive
 *  match against the `orders.email` field). 0 means the email is unknown to us
 *  — the request-link route swallows that result and still returns ok:true to
 *  prevent enumeration. */
export async function countOrdersByEmail(email: string): Promise<number> {
  const db = await getDb();
  return db.collection('orders').countDocuments({ email: email.toLowerCase() });
}

/**
 * Issue a single-use magic-link URL for a transactional email (order
 * confirmation, shipment notice). Generates the nonce, persists it with
 * the matching expiry, and returns the fully qualified verify URL.
 *
 *  - Default TTL is `MAGIC_LINK_LONG_TTL_MS` (30 days) since emails sit
 *    in inboxes; the recipient may open the link long after delivery.
 *  - Single-use enforcement remains via the nonce store, so the longer
 *    window does not enable replay attacks beyond "this email-recipient
 *    can sign in once".
 *  - Returns `null` when account auth is not configured (missing HMAC
 *    secret) — callers should silently omit the CTA from the email
 *    rather than failing the surrounding flow (order placement, etc.).
 */
export async function issueMagicLinkForEmail(args: {
  email: string;
  locale: MagicLinkLocale;
  baseUrl: string;
  ttlMs?: number;
}): Promise<string | null> {
  if (!isAccountAuthConfigured()) return null;
  const ttlMs = args.ttlMs ?? MAGIC_LINK_LONG_TTL_MS;
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);
  await recordIssuedToken(nonce, args.email, expiresAt);
  const token = createMagicLinkToken(args.email, args.locale, nonce, ttlMs);
  const base = args.baseUrl.replace(/\/$/, '');
  return `${base}/api/account/verify?token=${encodeURIComponent(token)}`;
}

/** Lists orders belonging to a single email, newest first. Used by the
 *  customer dashboard. The dashboard currently has no pagination — caller
 *  receives the full list (most customers have <10 orders). */
export async function listOrdersForEmail(email: string) {
  const db = await getDb();
  return db
    .collection('orders')
    .find({ email: email.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
}
