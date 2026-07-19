import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAppliedCoupon,
  readAppliedCoupon,
  storeAppliedCoupon,
  type AppliedCoupon,
} from '@/lib/applied-coupon';

const KEY = 'sf_applied_coupon';

const sample: AppliedCoupon = {
  code: 'SHOP-AB23-CD45',
  discountPercent: 10,
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  email: 'buyer@example.test',
};

describe('applied-coupon helper', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('roundtrips store + read', () => {
    storeAppliedCoupon(sample);
    expect(readAppliedCoupon()).toEqual(sample);
  });

  it('returns null when nothing is stored', () => {
    expect(readAppliedCoupon()).toBeNull();
  });

  it('clearAppliedCoupon removes the key', () => {
    storeAppliedCoupon(sample);
    clearAppliedCoupon();
    expect(readAppliedCoupon()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('auto-clears an expired coupon and returns null', () => {
    const expired: AppliedCoupon = {
      ...sample,
      validUntil: new Date(Date.now() - 60_000).toISOString(),
    };
    storeAppliedCoupon(expired);
    expect(readAppliedCoupon()).toBeNull();
    // Side-effect: the storage key was removed.
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('returns null for malformed JSON and does not throw', () => {
    window.localStorage.setItem(KEY, '{not valid json');
    expect(() => readAppliedCoupon()).not.toThrow();
    expect(readAppliedCoupon()).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ code: 'X' /* no discountPercent */ }));
    expect(readAppliedCoupon()).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ discountPercent: 10 /* no code */ }));
    expect(readAppliedCoupon()).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ code: '', discountPercent: 10 }));
    expect(readAppliedCoupon()).toBeNull();
  });

  it('preserves a coupon that has no validUntil (treated as live)', () => {
    const noExpiry = { code: 'SHOP-XX-YY', discountPercent: 5 } as AppliedCoupon;
    window.localStorage.setItem(KEY, JSON.stringify(noExpiry));
    const read = readAppliedCoupon();
    expect(read).toEqual(noExpiry);
  });
});
