import { describe, expect, it } from 'vitest';
import { getReviewsByLocale } from '@/data/reviews-registry';
import type { Review } from '@/data/reviews';
import { sortReviewsForTopic, topTopics } from '@/lib/reviews';

// Demo catalog: all 5 products, each has reviews
const osloReviews = getReviewsByLocale('oslo-nightstand');
const ariaReviews = getReviewsByLocale('aria-console');
const haloReviews = getReviewsByLocale('halo-table-lamp');
const lumenReviews = getReviewsByLocale('lumen-floor-lamp');
const terraReviews = getReviewsByLocale('terra-path-light');

describe('product review fixtures', () => {
  it('has reviews for each demo product', () => {
    expect(osloReviews.length).toBeGreaterThan(0);
    expect(ariaReviews.length).toBeGreaterThan(0);
    expect(haloReviews.length).toBeGreaterThan(0);
    expect(lumenReviews.length).toBeGreaterThan(0);
    expect(terraReviews.length).toBeGreaterThan(0);
  });

  it('uses unique review IDs across all products', () => {
    const all = [...osloReviews, ...ariaReviews, ...haloReviews, ...lumenReviews, ...terraReviews];
    const ids = new Set(all.map((review) => review.id));
    expect(ids.size).toBe(all.length);
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
