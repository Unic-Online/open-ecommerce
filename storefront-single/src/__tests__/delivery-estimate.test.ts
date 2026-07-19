import { describe, expect, it } from 'vitest';
import {
  estimateNextShippingDate,
  formatDeliveryDate,
  isBusinessDay,
} from '@/lib/delivery-estimate';

describe('delivery estimate', () => {
  it('moves weekend orders to the next business day', () => {
    // 2026-05-03 is a Sunday → next business day is Monday 4 May
    const date = estimateNextShippingDate(new Date(2026, 4, 3, 14, 0, 0));
    expect(formatDeliveryDate(date)).toBe('Monday, 4 May 2026');
  });

  it('adds two business days for weekday orders', () => {
    // 2026-05-01 is a Friday → +2 business days = Tuesday 5 May
    const date = estimateNextShippingDate(new Date(2026, 4, 1, 10, 0, 0));
    expect(formatDeliveryDate(date)).toBe('Tuesday, 5 May 2026');
  });

  it('treats only Monday through Friday as business days', () => {
    expect(isBusinessDay(new Date(2026, 4, 4))).toBe(true);   // Monday
    expect(isBusinessDay(new Date(2026, 4, 9))).toBe(false);  // Saturday
    expect(isBusinessDay(new Date(2026, 4, 10))).toBe(false); // Sunday
  });
});
