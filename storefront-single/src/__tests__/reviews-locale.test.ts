import { describe, expect, it } from 'vitest';
import { getReviewsByLocale } from '@/data/reviews-registry';

// Demo catalog product keys (slug = reviewsKey for all demo products)
const PRODUCT_KEYS = [
  'oslo-nightstand',
  'aria-console',
  'halo-table-lamp',
  'lumen-floor-lamp',
  'terra-path-light',
] as const;

describe('reviews-registry', () => {
  for (const key of PRODUCT_KEYS) {
    describe(`product "${key}"`, () => {
      const reviews = getReviewsByLocale(key);

      it('has reviews', () => {
        expect(reviews.length).toBeGreaterThan(0);
      });

      it('preserves rating, date, helpfulCount per review', () => {
        for (const review of reviews) {
          expect(typeof review.rating).toBe('number');
          expect(review.rating).toBeGreaterThanOrEqual(1);
          expect(review.rating).toBeLessThanOrEqual(5);
          expect(typeof review.date).toBe('string');
          expect(review.date.trim().length).toBeGreaterThan(0);
          expect(typeof review.helpfulCount).toBe('number');
        }
      });

      it('all review fields are non-empty strings', () => {
        for (const review of reviews) {
          expect(review.name.trim().length).toBeGreaterThan(0);
          expect(review.title.trim().length).toBeGreaterThan(0);
          expect(review.text.trim().length).toBeGreaterThan(0);
          expect(review.location.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('returns [] for unknown reviewsKey', () => {
    expect(getReviewsByLocale('does-not-exist')).toEqual([]);
  });
});
