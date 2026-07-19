import { describe, expect, it } from 'vitest';
import {
  estimateNextShippingDate,
  formatRomanianDeliveryDate,
  isBusinessDay,
} from '@/lib/delivery-estimate';

describe('delivery estimate', () => {
  it('moves weekend orders to the next business day', () => {
    const date = estimateNextShippingDate(new Date(2026, 4, 3, 14, 0, 0));

    expect(formatRomanianDeliveryDate(date)).toBe('luni, 04 mai 2026');
  });

  it('adds two business days for weekday orders', () => {
    const date = estimateNextShippingDate(new Date(2026, 4, 1, 10, 0, 0));

    expect(formatRomanianDeliveryDate(date)).toBe('marți, 05 mai 2026');
  });

  it('treats only Monday through Friday as business days', () => {
    expect(isBusinessDay(new Date(2026, 4, 4))).toBe(true);
    expect(isBusinessDay(new Date(2026, 4, 9))).toBe(false);
    expect(isBusinessDay(new Date(2026, 4, 10))).toBe(false);
  });
});
