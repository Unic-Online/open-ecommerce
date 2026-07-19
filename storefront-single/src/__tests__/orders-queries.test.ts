import { describe, expect, it } from 'vitest';
import { buildListFilter } from '@/lib/orders/queries';

describe('buildListFilter', () => {
  it('returns an empty filter when no inputs are provided', () => {
    expect(buildListFilter({})).toEqual({});
  });

  it('drops "all" sentinels for status, paymentMethod, market, fulfillment', () => {
    expect(
      buildListFilter({
        status: 'all',
        paymentMethod: 'all',
        market: 'all',
        fulfillment: 'all',
      }),
    ).toEqual({});
  });

  it('passes concrete enum filters straight through', () => {
    expect(
      buildListFilter({
        status: 'paid',
        paymentMethod: 'card',
        market: 'main',
        fulfillment: 'shipped',
      }),
    ).toMatchInlineSnapshot(`
      {
        "fulfillment.status": "shipped",
        "market": "main",
        "paymentMethod": "card",
        "status": "paid",
      }
    `);
  });

  it('treats fulfillment="unfulfilled" as missing-or-explicit', () => {
    const f = buildListFilter({ fulfillment: 'unfulfilled' });
    expect(f).toEqual({
      $or: [
        { fulfillment: { $exists: false } },
        { 'fulfillment.status': 'unfulfilled' },
      ],
    });
  });

  it('builds an inclusive createdAt range', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');
    expect(buildListFilter({ from, to })).toEqual({
      createdAt: { $gte: from, $lte: to },
    });
  });

  it('builds half-open ranges when only one bound is set', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(buildListFilter({ from })).toEqual({ createdAt: { $gte: from } });
  });

  it('matches q against orderId (uppercased), email, name and phone case-insensitively', () => {
    const f = buildListFilter({ q: 'a1b2 .*' });
    expect(f).toEqual({
      $and: [
        {
          $or: [
            { orderId: { $regex: 'A1B2 \\.\\*' } },
            { email: { $options: 'i', $regex: 'a1b2 \\.\\*' } },
            { 'shipping.firstName': { $options: 'i', $regex: 'a1b2 \\.\\*' } },
            { 'shipping.lastName': { $options: 'i', $regex: 'a1b2 \\.\\*' } },
            { 'shipping.phone': { $options: 'i', $regex: 'a1b2 \\.\\*' } },
          ],
        },
      ],
    });
  });

  it('ignores whitespace-only q', () => {
    expect(buildListFilter({ q: '   ' })).toEqual({});
  });

  it('combines status + market + q without losing fields', () => {
    const f = buildListFilter({ status: 'paid', market: 'main', q: 'alex' });
    expect(f.status).toBe('paid');
    expect(f.market).toBe('main');
    expect(f.$and).toBeDefined();
  });
});
