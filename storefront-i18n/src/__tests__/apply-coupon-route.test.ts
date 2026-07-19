/**
 * POST /api/cart/apply-coupon (issue #19): bot guard, schema validation,
 * dry-run, and every validateCoupon outcome — unknown / already-used /
 * expired / wrong-email / valid — through the real coupons lib against the
 * shared Mongo mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mongoMock } from './helpers/mongodb.mock';

const { mockIsDryRun } = vi.hoisted(() => ({
  mockIsDryRun: vi.fn(() => false),
}));

vi.mock('@/lib/mongodb', () => mongoMock.module());
vi.mock('@/plugins/abandoned-cart/config', () => ({
  isAbandonedCartDryRun: mockIsDryRun,
}));

import { POST } from '@/app/api/cart/apply-coupon/route';
import { COUPONS_COLLECTION, type CouponDoc } from '@/plugins/abandoned-cart/shared/types';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

function makeRequest(body: unknown, ua: string = BROWSER_UA): Request {
  return new Request('http://localhost/api/cart/apply-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': ua },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    code: 'SHOP-ABCD-EFGH',
    email: 'ion@test.ro',
    botCheck: 'browser-token',
    ...overrides,
  };
}

function couponDoc(overrides: Partial<CouponDoc> = {}): CouponDoc {
  return {
    code: 'SHOP-ABCD-EFGH',
    cartId: 'cart-1',
    email: 'ion@test.ro',
    discountPercent: 10,
    maxUses: 1,
    usedCount: 0,
    validFrom: new Date(Date.now() - 60_000),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 60_000),
    ...overrides,
  };
}

const coupons = () => mongoMock.collection(COUPONS_COLLECTION);

beforeEach(() => {
  mongoMock.reset();
  mockIsDryRun.mockReturnValue(false);
});

describe('POST /api/cart/apply-coupon', () => {
  it('400 malformed on a non-JSON body', async () => {
    const res = await POST(makeRequest('{not json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, reason: 'malformed' });
  });

  it('bot UA gets a flat unknown-code 200 — the endpoint must not be a coupon oracle for scrapers', async () => {
    const res = await POST(makeRequest(validBody(), 'curl/8.4.0'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false, reason: 'unknown-code' });
    expect(coupons().findOne).not.toHaveBeenCalled();
  });

  it('missing botCheck token is treated as a bot (same opaque response)', async () => {
    const res = await POST(makeRequest({ code: 'SHOP-ABCD-EFGH', email: 'ion@test.ro' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false, reason: 'unknown-code' });
    expect(coupons().findOne).not.toHaveBeenCalled();
  });

  it('400 malformed when the code fails the schema (illegal characters)', async () => {
    const res = await POST(makeRequest(validBody({ code: 'SHOP/©/DROP' })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, reason: 'malformed' });
  });

  it('400 malformed on an invalid email', async () => {
    const res = await POST(makeRequest(validBody({ email: 'not-an-email' })));
    expect(res.status).toBe(400);
  });

  it('dry-run (no DB) answers unknown-code truthfully, flagged dryRun', async () => {
    mockIsDryRun.mockReturnValue(true);
    const res = await POST(makeRequest(validBody()));
    expect(await res.json()).toEqual({
      valid: false,
      reason: 'unknown-code',
      dryRun: true,
    });
    expect(coupons().findOne).not.toHaveBeenCalled();
  });

  it('unknown code → { valid: false, unknown-code }; lookup is case-insensitive (uppercased)', async () => {
    coupons().findOne.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(validBody({ code: 'shop-abcd-efgh' })));
    expect(await res.json()).toEqual({ valid: false, reason: 'unknown-code' });
    expect(coupons().findOne).toHaveBeenCalledWith({ code: 'SHOP-ABCD-EFGH' });
  });

  it('whitespace-padded code is rejected by the strict schema (codes are system-generated, never typed)', async () => {
    const res = await POST(makeRequest(validBody({ code: '  SHOP-ABCD-EFGH ' })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ valid: false, reason: 'malformed' });
  });

  it('already-redeemed coupon → already-used', async () => {
    coupons().findOne.mockResolvedValueOnce(couponDoc({ usedCount: 1 }));
    const res = await POST(makeRequest(validBody()));
    expect(await res.json()).toEqual({ valid: false, reason: 'already-used' });
  });

  it('expired coupon → expired', async () => {
    coupons().findOne.mockResolvedValueOnce(
      couponDoc({ validUntil: new Date(Date.now() - 1000) }),
    );
    const res = await POST(makeRequest(validBody()));
    expect(await res.json()).toEqual({ valid: false, reason: 'expired' });
  });

  it('coupon bound to a different email → wrong-email', async () => {
    coupons().findOne.mockResolvedValueOnce(couponDoc({ email: 'altcineva@test.ro' }));
    const res = await POST(makeRequest(validBody()));
    expect(await res.json()).toEqual({ valid: false, reason: 'wrong-email' });
  });

  it('email comparison is case/whitespace-insensitive', async () => {
    coupons().findOne.mockResolvedValueOnce(couponDoc());
    const res = await POST(makeRequest(validBody({ email: 'ION@test.ro' })));
    expect((await res.json()).valid).toBe(true);
  });

  it('valid coupon → discountPercent + ISO validUntil', async () => {
    // Far-future relative date so this assertion never expires (was a
    // hardcoded 2026-06-20 time bomb).
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    coupons().findOne.mockResolvedValueOnce(couponDoc({ validUntil, discountPercent: 10 }));
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: true,
      discountPercent: 10,
      validUntil: validUntil.toISOString(),
    });
  });
});
