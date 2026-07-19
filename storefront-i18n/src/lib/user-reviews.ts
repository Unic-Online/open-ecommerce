// User-submitted reviews — stored in localStorage only, displayed
// alongside curated reviews on the product page. No server roundtrip:
// each browser sees its own user-submitted reviews. The optional email
// field is preserved in storage for future export but never rendered.

import type { Review } from '@/data/reviews';

const STORAGE_PREFIX = 'sf_user_reviews_';
export const USER_REVIEW_CHANGED_EVENT = 'sf:user-review-changed';
// Any "Scrie o recenzie" CTA on the page can dispatch this event; the
// review form on the same product listens for it and toggles to its
// open state plus scrolls itself into view.
export const OPEN_REVIEW_FORM_EVENT = 'sf:open-review-form';

export interface UserReviewInput {
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  text: string;
  email?: string;
}

function key(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `user-${crypto.randomUUID()}`;
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(value: unknown): Review | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string') return null;
  if (typeof v.name !== 'string' || v.name.length === 0) return null;
  if (typeof v.text !== 'string') return null;
  const rating = typeof v.rating === 'number' ? Math.round(v.rating) : 0;
  if (rating < 1 || rating > 5) return null;
  return {
    id: v.id,
    name: v.name,
    location: typeof v.location === 'string' ? v.location : '',
    rating: rating as 1 | 2 | 3 | 4 | 5,
    title: typeof v.title === 'string' && v.title.trim() ? v.title : 'Recenzie',
    text: v.text,
    date: typeof v.date === 'string' ? v.date : new Date().toISOString(),
    product: typeof v.product === 'string' ? v.product : '',
    verifiedPurchase: false,
    helpfulCount: 0,
  };
}

export function readUserReviews(slug: string): Review[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((r): r is Review => r !== null);
  } catch {
    return [];
  }
}

// useSyncExternalStore support. The snapshot is cached per slug and only
// re-parsed when the underlying raw string changes, so the returned array is
// referentially stable across renders (a fresh array on every call would
// make React's store-consistency check loop).
const EMPTY_REVIEWS: Review[] = [];
const snapshotCache = new Map<string, { raw: string | null; value: Review[] }>();

export function getUserReviewsSnapshot(slug: string | undefined): Review[] {
  if (!slug || typeof window === 'undefined') return EMPTY_REVIEWS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key(slug));
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(slug);
  if (cached && cached.raw === raw) return cached.value;
  const value = raw === null ? EMPTY_REVIEWS : readUserReviews(slug);
  snapshotCache.set(slug, { raw, value });
  return value;
}

export function subscribeToUserReviews(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(USER_REVIEW_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(USER_REVIEW_CHANGED_EVENT, onChange);
}

export function addUserReview(slug: string, input: UserReviewInput): Review {
  const review: Review = {
    id: genId(),
    name: input.name.trim().slice(0, 60),
    location: '',
    rating: input.rating,
    title: (input.title?.trim() || 'Recenzie').slice(0, 80),
    text: input.text.trim().slice(0, 2000),
    date: new Date().toISOString(),
    product: slug,
    verifiedPurchase: false,
    helpfulCount: 0,
  };

  if (typeof window === 'undefined') return review;

  try {
    const existing = readUserReviews(slug);
    // Persist email alongside the public Review fields. The optional
    // _email key is namespaced so a future renderer can ignore it
    // safely; no current code path reads it back into UI.
    const next = [
      input.email
        ? ({ ...review, _email: input.email } as Review & { _email: string })
        : review,
      ...existing,
    ];
    window.localStorage.setItem(key(slug), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(USER_REVIEW_CHANGED_EVENT, { detail: { slug } }),
    );
  } catch {
    /* storage full or unavailable — review is returned to the caller anyway */
  }
  return review;
}

export function clearUserReviews(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(slug));
    window.dispatchEvent(
      new CustomEvent(USER_REVIEW_CHANGED_EVENT, { detail: { slug } }),
    );
  } catch {
    /* storage unavailable */
  }
}
