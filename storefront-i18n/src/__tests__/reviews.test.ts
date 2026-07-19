import { describe, expect, it } from 'vitest';
import { getReviewsByLocale } from '@/data/reviews-registry';
import type { Review } from '@/data/reviews';
import { sortReviewsForTopic, topTopics } from '@/lib/reviews';

// Demo catalog: all 5 products, each has 3 reviews per locale
const osloEn = getReviewsByLocale('oslo-nightstand', 'en');
const ariaEn = getReviewsByLocale('aria-console', 'en');
const haloEn = getReviewsByLocale('halo-table-lamp', 'en');
const lumenEn = getReviewsByLocale('lumen-floor-lamp', 'en');
const terraEn = getReviewsByLocale('terra-path-light', 'en');

describe('product review fixtures', () => {
  it('has 3 EN reviews for each demo product', () => {
    expect(osloEn).toHaveLength(3);
    expect(ariaEn).toHaveLength(3);
    expect(haloEn).toHaveLength(3);
    expect(lumenEn).toHaveLength(3);
    expect(terraEn).toHaveLength(3);
  });

  it('uses unique review IDs across all EN products', () => {
    const all = [...osloEn, ...ariaEn, ...haloEn, ...lumenEn, ...terraEn];
    const ids = new Set(all.map((review) => review.id));
    expect(ids.size).toBe(all.length);
  });

  it('uses unique review IDs across all RO products', () => {
    const allRo = [
      ...getReviewsByLocale('oslo-nightstand', 'ro'),
      ...getReviewsByLocale('aria-console', 'ro'),
      ...getReviewsByLocale('halo-table-lamp', 'ro'),
      ...getReviewsByLocale('lumen-floor-lamp', 'ro'),
      ...getReviewsByLocale('terra-path-light', 'ro'),
    ];
    const ids = new Set(allRo.map((review) => review.id));
    expect(ids.size).toBe(allRo.length);
  });
});

describe('sortReviewsForTopic', () => {
  const reviews: Review[] = [
    review('low-helpful-matching', 2, ['quality']),
    review('high-helpful-other', 100, ['design']),
    review('high-helpful-matching', 30, ['quality']),
  ];

  it('puts reviews matching the selected aspect first', () => {
    expect(sortReviewsForTopic(reviews, 'quality').map((item) => item.id)).toEqual([
      'high-helpful-matching',
      'low-helpful-matching',
      'high-helpful-other',
    ]);
  });

  it('falls back to helpful sorting when no aspect is selected', () => {
    expect(sortReviewsForTopic(reviews, null).map((item) => item.id)).toEqual([
      'high-helpful-other',
      'high-helpful-matching',
      'low-helpful-matching',
    ]);
  });

  it('aggregates aspect counts for visible topic chips', () => {
    expect(topTopics(reviews).find((topic) => topic.key === 'quality')).toMatchObject({
      key: 'quality',
      count: 2,
    });
  });
});

function review(id: string, helpfulCount: number, topics: string[]): Review {
  return {
    id,
    name: 'Test',
    location: 'London',
    rating: 5,
    title: 'Test review',
    text: 'Test review body',
    date: '2026-01-01',
    product: 'Test product',
    helpfulCount,
    topics,
  };
}
