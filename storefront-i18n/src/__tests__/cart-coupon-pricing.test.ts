import { describe, expect, it } from 'vitest';
import {
  computeOrderTotal,
  WELCOME_DISCOUNT,
} from '@/lib/pricing';
import { generateCouponCode } from '@/plugins/abandoned-cart/server/coupons';

const ITEM = { quantity: 1, unitPrice: 1000 };
const ITEMS_2 = [{ quantity: 2, unitPrice: 500 }, { quantity: 1, unitPrice: 200 }];

describe('computeOrderTotal — coupon stacking', () => {
  it('applies only the default 10% discount when no coupon is supplied', () => {
    const result = computeOrderTotal([ITEM]);
    expect(result.subtotal).toBe(1000);
    expect(result.discount).toBe(100); // 10% of 1000
  });

  it('stacks a 10% coupon on top of the default 10%', () => {
    const result = computeOrderTotal([ITEM], { couponDiscountPercent: 10 });
    expect(result.subtotal).toBe(1000);
    expect(result.discount).toBe(200); // 20% of 1000
  });

  it('clamps an aggressive coupon to 80% so total never goes negative', () => {
    const result = computeOrderTotal([ITEM], { couponDiscountPercent: 90 });
    // coupon clamped to 80, plus the 10% welcome = 90% effective discount
    expect(result.discount).toBe(900);
    expect(result.total).toBeGreaterThan(0);
  });

  it('treats a 0 coupon as no coupon', () => {
    const noCoupon = computeOrderTotal([ITEM]);
    const zeroCoupon = computeOrderTotal([ITEM], { couponDiscountPercent: 0 });
    expect(zeroCoupon.discount).toBe(noCoupon.discount);
  });

  it('applies free shipping when subtotal >= 600 regardless of coupon', () => {
    const items = [{ quantity: 1, unitPrice: 700 }];
    const withCoupon = computeOrderTotal(items, { couponDiscountPercent: 10 });
    expect(withCoupon.shippingCost).toBe(0);
  });

  it('keeps standard shipping below threshold even with coupon', () => {
    const items = [{ quantity: 1, unitPrice: 100 }];
    const withCoupon = computeOrderTotal(items, { couponDiscountPercent: 10 });
    expect(withCoupon.shippingCost).toBeGreaterThan(0);
  });

  it('handles multi-item carts the same way', () => {
    const result = computeOrderTotal(ITEMS_2, { couponDiscountPercent: 10 });
    // subtotal = 2*500 + 1*200 = 1200, discount = 1200*0.20 = 240
    expect(result.subtotal).toBe(1200);
    expect(result.discount).toBe(240);
  });

  it('default welcome discount constant is 10%', () => {
    expect(WELCOME_DISCOUNT).toBe(0.1);
  });
});

describe('generateCouponCode', () => {
  it('matches the expected format SHOP-XXXX-XXXX', () => {
    const code = generateCouponCode();
    expect(code).toMatch(/^SHOP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it('uses a copy-paste-friendly alphabet in the random blocks (no 0/O/1/I/L)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCouponCode();
      // Strip the constant 'SHOP-' prefix; only the random blocks must use the
      // restricted alphabet. The prefix itself contains 'I' and 'O' on purpose
      // for brand recognisability.
      const randomPart = code.replace(/^SHOP-/, '');
      expect(randomPart).not.toMatch(/[01ILO]/);
    }
  });

  it('produces no collisions in 1000 generations', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      codes.add(generateCouponCode());
    }
    expect(codes.size).toBe(1000);
  });
});
