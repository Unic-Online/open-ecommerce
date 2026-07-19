/**
 * Reviews registry — resolves a product's reviews by `reviewsKey` + locale.
 *
 * Reviews now live embedded in the unified product files
 * (`content/products/<slug>.ts` under `locales.<locale>.reviews`). This module
 * keeps the legacy `getReviewsByLocale(reviewsKey, locale)` API so consumers
 * (product pages, listing pages, homepage stats) don't change.
 *
 * A product is matched by its `business.reviewsKey` (falls back to `slug`).
 * A locale with no embedded reviews degrades to an empty array, and the
 * product page hides the review section entirely.
 */
import type { LocaleKey } from '@/i18n/locales';
import type { Review } from './reviews';
import { PRODUCTS } from '@/../content/products';
import { getProductReviews, type DefinedProduct } from '@/lib/product-schema';

const BY_REVIEWS_KEY: Record<string, DefinedProduct> = (() => {
  const out: Record<string, DefinedProduct> = {};
  for (const p of PRODUCTS) {
    out[p.business.reviewsKey ?? p.slug] = p;
    // Also index by slug so callers that pass the slug directly still resolve.
    out[p.slug] = p;
  }
  return out;
})();

export function getReviewsByLocale(reviewsKey: string, locale: LocaleKey): Review[] {
  const product = BY_REVIEWS_KEY[reviewsKey];
  if (!product) return [];
  return getProductReviews(product, locale);
}
