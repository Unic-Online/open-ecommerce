/**
 * MongoDB persistence for customer-submitted product reviews (the `reviews`
 * collection) — public submission, admin moderation, and the approved-review
 * read path consumed by the product pages.
 *
 * Invariants:
 *   - Every submission lands as `status: 'pending'`; only `decideReview`
 *     (admin-only, atomic `findOneAndUpdate` filtered on `status: 'pending'`)
 *     moves it to `'approved'` / `'declined'`. Declined reviews are kept
 *     (audit trail) but `getApprovedReviews` never returns them.
 *   - `verifiedPurchase: true` reviews carry an `orderId`. The unique partial
 *     index on `{ orderId, slug }` (only when `orderId` exists) makes a
 *     second verified review for the same order+product a duplicate-key
 *     error, caught by `insertPendingReview` and surfaced as `{ ok: false,
 *     reason: 'duplicate' }` — atomic, no read-then-write race.
 *   - `getApprovedReviews` is keyed by product `slug` (the exact product
 *     purchased/reviewed). `getMergedReviews` combines it with the curated
 *     static corpus, looked up by `reviewsKey` — matching the same lookup
 *     `CategoryProductPage.tsx` already uses for the static side.
 *   - Dry-run short-circuits (mirrors `lib/orders/mutations.ts`): when
 *     `isAbandonedCartDryRun()` is true, writes return `{ ok: false, reason:
 *     'dry-run' }` without touching the DB.
 * Side effects: reads/writes the `reviews` collection.
 * Caller contract: `insertPendingReview` callers MUST check `result.ok`
 *   before assuming the review was persisted (duplicate / dry-run both fail
 *   silently from the DB's point of view).
 */
import { ObjectId } from 'mongodb';
import { getDb, isDbConfigured } from '@/lib/mongodb';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { isDuplicateKeyError } from '@/lib/orders/order-id';
import type { LocaleKey } from '@/i18n/locales';
import type { MarketKey } from '@/i18n/market-config';
import type { Review } from '@/data/reviews';
import { getReviewsByLocale } from '@/data/reviews-registry';

export const REVIEWS_COLLECTION = 'reviews';

export type ReviewStatus = 'pending' | 'approved' | 'declined';

export interface ReviewDoc {
  _id?: ObjectId;
  slug: string;
  reviewsKey?: string;
  name: string;
  email?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  text: string;
  locale: LocaleKey;
  market?: MarketKey;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  orderId?: string;
  clientIp?: string;
  clientUserAgent?: string;
  createdAt: Date;
  decidedAt?: Date;
}

let indexesEnsured = false;

/** Idempotent index creation, once per process (same pattern as `ensureOrdersIndexes`). */
async function ensureReviewsIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const c = db.collection(REVIEWS_COLLECTION);
  await c.createIndex({ slug: 1, locale: 1, status: 1, createdAt: -1 });
  await c.createIndex({ status: 1, createdAt: -1 });
  await c.createIndex({ clientIp: 1, createdAt: -1 }, { sparse: true });
  // Partial unique index: only enforced when orderId is present, so organic
  // (non-verified) reviews never collide on this key.
  await c.createIndex(
    { orderId: 1, slug: 1 },
    { unique: true, partialFilterExpression: { orderId: { $exists: true } } },
  );
  indexesEnsured = true;
}

export interface InsertReviewInput {
  slug: string;
  reviewsKey?: string;
  name: string;
  email?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  text: string;
  locale: LocaleKey;
  market?: MarketKey;
  verifiedPurchase: boolean;
  orderId?: string;
  clientIp?: string;
  clientUserAgent?: string;
}

export type InsertReviewResult =
  | { ok: true; review: ReviewDoc }
  | { ok: false; reason: 'duplicate' | 'dry-run' };

/** Insert a new submission as `status: 'pending'`. Never auto-approves. */
export async function insertPendingReview(input: InsertReviewInput): Promise<InsertReviewResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };
  await ensureReviewsIndexes();
  const db = await getDb();
  const doc: ReviewDoc = { ...input, status: 'pending', createdAt: new Date() };
  try {
    const result = await db.collection<ReviewDoc>(REVIEWS_COLLECTION).insertOne(doc);
    return { ok: true, review: { ...doc, _id: result.insertedId } };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { ok: false, reason: 'duplicate' };
    throw err;
  }
}

/** Rolling-window abuse guard: how many reviews this IP has submitted recently. */
export async function countRecentReviewsByIp(
  clientIp: string,
  withinMs = 24 * 60 * 60 * 1000,
): Promise<number> {
  const db = await getDb();
  return db.collection(REVIEWS_COLLECTION).countDocuments({
    clientIp,
    createdAt: { $gte: new Date(Date.now() - withinMs) },
  });
}

export interface ListReviewsFilters {
  status?: ReviewStatus | 'all';
  skip?: number;
  limit?: number;
}

export interface ListReviewsResult {
  reviews: ReviewDoc[];
  total: number;
}

/** Admin listing — defaults to no filter (caller/page picks the default status). */
export async function listReviews(f: ListReviewsFilters = {}): Promise<ListReviewsResult> {
  const db = await getDb();
  const c = db.collection<ReviewDoc>(REVIEWS_COLLECTION);
  const filter: Record<string, unknown> = {};
  if (f.status && f.status !== 'all') filter.status = f.status;

  const skip = Math.max(0, f.skip ?? 0);
  const limit = Math.min(Math.max(1, f.limit ?? 50), 200);

  const [reviews, total] = await Promise.all([
    c.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    c.countDocuments(filter),
  ]);
  return { reviews: reviews as unknown as ReviewDoc[], total };
}

export type DecideReviewResult =
  | { ok: true; review: ReviewDoc }
  | { ok: false; reason: 'not-found' | 'already-decided' | 'dry-run' };

/**
 * Operator moderation decision. Atomic: the filter requires `status:
 * 'pending'`, so two concurrent decisions (or a double-click) can't both
 * "succeed" — the loser sees `already-decided`.
 */
export async function decideReview(
  reviewId: string,
  action: 'approved' | 'declined',
): Promise<DecideReviewResult> {
  if (isAbandonedCartDryRun()) return { ok: false, reason: 'dry-run' };
  let _id: ObjectId;
  try {
    _id = new ObjectId(reviewId);
  } catch {
    return { ok: false, reason: 'not-found' };
  }
  const db = await getDb();
  const c = db.collection<ReviewDoc>(REVIEWS_COLLECTION);
  const result = await c.findOneAndUpdate(
    { _id, status: 'pending' },
    { $set: { status: action, decidedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!result) {
    const existing = await c.findOne({ _id });
    if (!existing) return { ok: false, reason: 'not-found' };
    return { ok: false, reason: 'already-decided' };
  }
  return { ok: true, review: result as unknown as ReviewDoc };
}

const FALLBACK_TITLE: Record<LocaleKey, string> = {
  ro: 'Recenzie',
  en: 'Review',
};

/** Approved DB reviews for a single product, mapped to the display `Review` shape. */
export async function getApprovedReviews(slug: string, locale: LocaleKey): Promise<Review[]> {
  // Zero-env (no MONGODB_URI): no user reviews can exist — product pages
  // degrade to the curated static corpus instead of failing the build.
  if (!isDbConfigured()) return [];
  const db = await getDb();
  const docs = await db
    .collection<ReviewDoc>(REVIEWS_COLLECTION)
    .find({ slug, locale, status: 'approved' })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) => ({
    id: doc._id!.toHexString(),
    name: doc.name,
    location: '',
    rating: doc.rating,
    title: doc.title?.trim() || FALLBACK_TITLE[locale],
    text: doc.text,
    date: doc.createdAt.toISOString(),
    product: doc.slug,
    verifiedPurchase: doc.verifiedPurchase,
    helpfulCount: 0,
    topics: [],
  }));
}

/**
 * What the product page actually renders: genuine DB-approved reviews first
 * (newest first), then the curated/static corpus (unchanged ordering).
 * `reviewsKey` gates the static lookup exactly as before this feature —
 * DB reviews are independent of it (any product can receive a real review).
 */
export async function getMergedReviews(
  slug: string,
  reviewsKey: string | undefined,
  locale: LocaleKey,
): Promise<Review[]> {
  const staticReviews = reviewsKey ? getReviewsByLocale(reviewsKey, locale) : [];
  const dbReviews = await getApprovedReviews(slug, locale);
  return [...dbReviews, ...staticReviews];
}
