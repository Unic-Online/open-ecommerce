import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addUserReview,
  clearUserReviews,
  readUserReviews,
} from '@/lib/user-reviews';

const SLUG = 'oslo-nightstand';

describe('user-reviews helper', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty list when nothing has been stored', () => {
    expect(readUserReviews(SLUG)).toEqual([]);
  });

  it('roundtrips a single review', () => {
    addUserReview(SLUG, {
      name: 'Ion P.',
      rating: 5,
      title: 'Foarte mulțumit',
      text: 'Recenzie de proba 1234567890',
    });
    const list = readUserReviews(SLUG);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Ion P.');
    expect(list[0].rating).toBe(5);
    expect(list[0].title).toBe('Foarte mulțumit');
    expect(list[0].text).toBe('Recenzie de proba 1234567890');
    expect(list[0].product).toBe(SLUG);
    expect(list[0].id).toMatch(/^user-/);
    expect(list[0].verifiedPurchase).toBe(false);
  });

  it('prepends the newest review (most recent first)', () => {
    addUserReview(SLUG, { name: 'Older', rating: 4, text: 'Recenzia mai veche' });
    addUserReview(SLUG, { name: 'Newer', rating: 5, text: 'Recenzia mai noua' });
    const list = readUserReviews(SLUG);
    expect(list.map((r) => r.name)).toEqual(['Newer', 'Older']);
  });

  it('keeps reviews scoped to their product slug', () => {
    addUserReview('oslo-nightstand', { name: 'A', rating: 5, text: 'Pentru noptiera Oslo — text lung' });
    addUserReview('aria-console', { name: 'B', rating: 4, text: 'Pentru consola Aria — text lung' });

    expect(readUserReviews('oslo-nightstand').map((r) => r.name)).toEqual(['A']);
    expect(readUserReviews('aria-console').map((r) => r.name)).toEqual(['B']);
    expect(readUserReviews('does-not-exist')).toEqual([]);
  });

  it('falls back to a default title when none is provided', () => {
    addUserReview(SLUG, { name: 'Test', rating: 5, text: 'Recenzie text suficient' });
    const list = readUserReviews(SLUG);
    expect(list[0].title).toBe('Recenzie');
  });

  it('clamps name to 60 chars and text to 2000 chars', () => {
    const longName = 'x'.repeat(120);
    const longText = 'y'.repeat(5000);
    addUserReview(SLUG, { name: longName, rating: 3, text: longText });
    const list = readUserReviews(SLUG);
    expect(list[0].name).toHaveLength(60);
    expect(list[0].text).toHaveLength(2000);
  });

  it('clearUserReviews wipes the list', () => {
    addUserReview(SLUG, { name: 'X', rating: 5, text: 'Recenzia mea de proba' });
    expect(readUserReviews(SLUG)).toHaveLength(1);
    clearUserReviews(SLUG);
    expect(readUserReviews(SLUG)).toEqual([]);
  });

  it('preserves the optional email field in storage but not in the public Review', () => {
    addUserReview(SLUG, {
      name: 'EmailUser',
      rating: 5,
      text: 'Cu email pe scenariu',
      email: 'buyer@example.com',
    });
    // Public read returns the canonical Review fields only — no _email key
    // is exposed on the typed result.
    const list = readUserReviews(SLUG);
    expect(list[0]).not.toHaveProperty('email');
    // The raw stash still has the email under the namespaced field.
    const raw = JSON.parse(window.localStorage.getItem('sf_user_reviews_oslo-nightstand') || '[]');
    expect(raw[0]._email).toBe('buyer@example.com');
  });

  it('returns null-equivalents for malformed entries', () => {
    window.localStorage.setItem(
      'sf_user_reviews_oslo-nightstand',
      JSON.stringify([
        { id: 'good', name: 'OK', rating: 4, text: 'Text valid de minim zece caractere', product: 'oslo-nightstand' },
        { id: 'bad-no-rating', name: 'X', text: 'no rating' },
        { id: 'bad-rating-out-of-range', name: 'X', rating: 9, text: 'out of range' },
        'not-an-object',
      ]),
    );
    const list = readUserReviews('oslo-nightstand');
    expect(list.map((r) => r.id)).toEqual(['good']);
  });

  it('is a no-op (returns the review object) on the server side', () => {
    // Simulate SSR by stripping window briefly
    const win = global.window;
    Object.defineProperty(global, 'window', { value: undefined, configurable: true });
    try {
      const review = addUserReview('oslo-nightstand', { name: 'SSR', rating: 5, text: 'In SSR mode lol' });
      expect(review.name).toBe('SSR');
      expect(readUserReviews('oslo-nightstand')).toEqual([]);
    } finally {
      Object.defineProperty(global, 'window', { value: win, configurable: true });
    }
  });
});
