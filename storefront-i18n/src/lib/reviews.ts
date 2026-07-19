import type { Review, ReviewSentiment } from '@/data/reviews';

export interface ReviewSummary {
  average: number;
  total: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, { count: number; ratio: number }>;
}

export function summarizeReviews(reviews: Review[]): ReviewSummary {
  const total = reviews.length;
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    breakdown[r.rating]++;
    sum += r.rating;
  }
  const average = total === 0 ? 0 : sum / total;
  return {
    average,
    total,
    breakdown: {
      1: { count: breakdown[1], ratio: total === 0 ? 0 : breakdown[1] / total },
      2: { count: breakdown[2], ratio: total === 0 ? 0 : breakdown[2] / total },
      3: { count: breakdown[3], ratio: total === 0 ? 0 : breakdown[3] / total },
      4: { count: breakdown[4], ratio: total === 0 ? 0 : breakdown[4] / total },
      5: { count: breakdown[5], ratio: total === 0 ? 0 : breakdown[5] / total },
    },
  };
}

export interface TopicAggregate {
  key: string;
  count: number;
  avgRating: number;
  sentiment: ReviewSentiment;
}

export function topTopics(reviews: Review[], limit = 6): TopicAggregate[] {
  const acc = new Map<string, { count: number; sum: number }>();
  for (const r of reviews) {
    if (!r.topics) continue;
    for (const t of r.topics) {
      const cur = acc.get(t) ?? { count: 0, sum: 0 };
      cur.count++;
      cur.sum += r.rating;
      acc.set(t, cur);
    }
  }
  const entries: TopicAggregate[] = Array.from(acc.entries()).map(([key, v]) => {
    const avg = v.sum / v.count;
    const sentiment: ReviewSentiment = avg >= 4 ? 'positive' : avg >= 3 ? 'mixed' : 'negative';
    return { key, count: v.count, avgRating: avg, sentiment };
  });
  entries.sort((a, b) => b.count - a.count);
  return entries.slice(0, limit);
}

export function sortReviewsForTopic(reviews: Review[], topicKey: string | null): Review[] {
  return [...reviews].sort((a, b) => {
    if (topicKey) {
      const aMatches = reviewHasTopic(a, topicKey);
      const bMatches = reviewHasTopic(b, topicKey);
      if (aMatches !== bMatches) return aMatches ? -1 : 1;
    }

    const helpfulDelta = (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0);
    if (helpfulDelta !== 0) return helpfulDelta;

    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function reviewHasTopic(review: Review, topicKey: string): boolean {
  return review.topics?.includes(topicKey) ?? false;
}

export function formatReviewDate(iso: string, locale: 'ro' | 'en' = 'ro'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = locale === 'en' ? 'en-GB' : 'ro-RO';
  return d.toLocaleDateString(tag, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function reviewInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
