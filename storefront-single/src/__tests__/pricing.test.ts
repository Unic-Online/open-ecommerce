import { describe, it, expect } from 'vitest';
import {
  computeOrderTotal,
  computeShippingCost,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
  toMinorUnits,
  WELCOME_DISCOUNT,
} from '@/lib/pricing';
import type { OrderItem } from '@/lib/validation';

function item(price: number, quantity: number): OrderItem {
  return {
    id: `id-${price}-${quantity}`,
    productType: 'furniture',
    productName: 'Test product',
    quantity,
    unitPrice: price,
    slug: 'test-product',
    shortName: 'Test',
  };
}

describe('computeOrderTotal', () => {
  it('returns zeros for an empty cart', () => {
    expect(computeOrderTotal([])).toEqual({ subtotal: 0, discount: 0, shippingCost: 0, total: 0 });
  });

  it('applies the 10% welcome discount and standard shipping under the free-shipping threshold', () => {
    const out = computeOrderTotal([item(100, 1)]);
    expect(out.subtotal).toBe(100);
    expect(out.discount).toBe(10);
    expect(out.shippingCost).toBe(STANDARD_SHIPPING_COST);
    expect(out.total).toBe(100 - 10 + STANDARD_SHIPPING_COST);
  });

  it('sums multiple items before discounting', () => {
    const out = computeOrderTotal([item(199, 2), item(349, 1)]);
    expect(out.subtotal).toBe(747);
    expect(out.discount).toBe(Math.round(747 * WELCOME_DISCOUNT));
    expect(out.shippingCost).toBe(0);
    expect(out.total).toBe(out.subtotal - out.discount);
  });

  it('rounds the discount to a whole RON', () => {
    const out = computeOrderTotal([item(33, 1)]);
    // 33 * 0.10 = 3.3 → 3
    expect(out.discount).toBe(3);
    expect(out.shippingCost).toBe(STANDARD_SHIPPING_COST);
    expect(out.total).toBe(33 - 3 + STANDARD_SHIPPING_COST);
  });
});

describe('computeShippingCost', () => {
  it('charges standard shipping below 600 RON subtotal', () => {
    expect(computeShippingCost(FREE_SHIPPING_THRESHOLD - 1)).toBe(STANDARD_SHIPPING_COST);
  });

  it('makes shipping free at and above 600 RON subtotal', () => {
    expect(computeShippingCost(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(computeShippingCost(FREE_SHIPPING_THRESHOLD + 1)).toBe(0);
  });
});

describe('toMinorUnits', () => {
  it('converts RON to bani (×100)', () => {
    expect(toMinorUnits(199, 'RON')).toBe(19900);
  });

  it('converts EUR to cents (×100)', () => {
    expect(toMinorUnits(70.34, 'EUR')).toBe(7034);
  });

  it('keeps zero-decimal currencies unchanged', () => {
    expect(toMinorUnits(1500, 'JPY')).toBe(1500);
    expect(toMinorUnits(1500, 'KRW')).toBe(1500);
  });
});
