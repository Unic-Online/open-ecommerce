// Regression coverage for the useSyncExternalStore migration (lint fix,
// issue #24): ReviewSection consumes user reviews through
// getUserReviewsSnapshot/subscribeToUserReviews. React's store-consistency
// check requires the snapshot to be referentially stable while the
// underlying storage is unchanged — a fresh array on every call would
// re-render in a loop.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addUserReview,
  getUserReviewsSnapshot,
  subscribeToUserReviews,
} from '@/lib/user-reviews';

describe('getUserReviewsSnapshot', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the same array reference across calls while storage is unchanged', () => {
    addUserReview('sf01', { name: 'Ana', rating: 5, text: 'Foarte bun.' });
    const first = getUserReviewsSnapshot('sf01');
    const second = getUserReviewsSnapshot('sf01');
    expect(second).toBe(first);
    expect(first).toHaveLength(1);
    expect(first[0].name).toBe('Ana');
  });

  it('returns a stable empty array for missing slugs and undefined', () => {
    expect(getUserReviewsSnapshot('no-such-slug')).toBe(
      getUserReviewsSnapshot('no-such-slug'),
    );
    expect(getUserReviewsSnapshot(undefined)).toEqual([]);
    // Both empties must be the SAME reference so switching between a slug
    // with no reviews and no slug never changes snapshot identity.
    expect(getUserReviewsSnapshot(undefined)).toBe(
      getUserReviewsSnapshot('no-such-slug'),
    );
  });

  it('re-parses after a write and notifies subscribers', () => {
    const before = getUserReviewsSnapshot('sf02');
    let notified = 0;
    const unsubscribe = subscribeToUserReviews(() => {
      notified += 1;
    });
    addUserReview('sf02', { name: 'Ion', rating: 4, text: 'Bun.' });
    expect(notified).toBe(1);
    const after = getUserReviewsSnapshot('sf02');
    expect(after).not.toBe(before);
    expect(after).toHaveLength(1);
    unsubscribe();
    addUserReview('sf02', { name: 'Maria', rating: 5, text: 'Excelent.' });
    expect(notified).toBe(1); // unsubscribed — no further notifications
  });

  it('isolates snapshots per slug', () => {
    addUserReview('sf01', { name: 'Ana', rating: 5, text: 'Foarte bun.' });
    const sf01 = getUserReviewsSnapshot('sf01');
    addUserReview('sf03', { name: 'Dan', rating: 3, text: 'Ok.' });
    // A write to another slug must not change this slug's snapshot identity.
    expect(getUserReviewsSnapshot('sf01')).toBe(sf01);
  });
});
