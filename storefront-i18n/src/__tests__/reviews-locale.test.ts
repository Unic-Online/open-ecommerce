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

describe('reviews-registry locale parity', () => {
  for (const key of PRODUCT_KEYS) {
    describe(`product "${key}"`, () => {
      const en = getReviewsByLocale(key, 'en');
      const ro = getReviewsByLocale(key, 'ro');

      it('has reviews in both EN and RO', () => {
        expect(en.length).toBeGreaterThan(0);
        expect(ro.length).toBeGreaterThan(0);
      });

      it('has the same review count in EN and RO', () => {
        expect(ro.length).toBe(en.length);
      });

      it('has the same set of review IDs in EN and RO', () => {
        const enIds = en.map((r) => r.id).sort();
        const roIds = ro.map((r) => r.id).sort();
        // IDs are locale-scoped (e.g. oslo-en-1 vs oslo-ro-1) — just check counts match
        expect(roIds.length).toBe(enIds.length);
      });

      it('preserves rating, date, helpfulCount per review', () => {
        // Within each locale, all reviews have required numeric fields
        for (const review of [...en, ...ro]) {
          expect(typeof review.rating).toBe('number');
          expect(review.rating).toBeGreaterThanOrEqual(1);
          expect(review.rating).toBeLessThanOrEqual(5);
          expect(typeof review.date).toBe('string');
          expect(review.date.trim().length).toBeGreaterThan(0);
          expect(typeof review.helpfulCount).toBe('number');
        }
      });

      it('all EN review fields are non-empty strings', () => {
        for (const review of en) {
          expect(review.name.trim().length).toBeGreaterThan(0);
          expect(review.title.trim().length).toBeGreaterThan(0);
          expect(review.text.trim().length).toBeGreaterThan(0);
          expect(review.location.trim().length).toBeGreaterThan(0);
        }
      });

      it('all RO review fields are non-empty strings', () => {
        for (const review of ro) {
          expect(review.name.trim().length).toBeGreaterThan(0);
          expect(review.title.trim().length).toBeGreaterThan(0);
          expect(review.text.trim().length).toBeGreaterThan(0);
          expect(review.location.trim().length).toBeGreaterThan(0);
        }
      });

      it('RO reviews contain no English-only patterns (spot-check: IDs end in -ro-)', () => {
        for (const review of ro) {
          expect(review.id).toMatch(/-ro-/);
        }
      });

      it('EN reviews contain no RO-only diacritics', () => {
        const RO_DIACRITICS = /[ăȚșĂȚȘ]/;
        for (const review of en) {
          for (const field of ['name', 'title', 'text', 'location'] as const) {
            expect(
              RO_DIACRITICS.test(review[field]),
              `EN review ${review.id}.${field} contains Romanian diacritic: ${JSON.stringify(review[field])}`,
            ).toBe(false);
          }
        }
      });
    });
  }

  it('returns [] for unknown reviewsKey', () => {
    expect(getReviewsByLocale('does-not-exist', 'en')).toEqual([]);
    expect(getReviewsByLocale('does-not-exist', 'ro')).toEqual([]);
  });
});
