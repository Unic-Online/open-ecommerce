import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mongoMock } from './helpers/mongodb.mock';
import { resendPackageModule, sendEmailMock } from './helpers/resend.mock';
import { buildShipping, buildCartItem } from './helpers/builders';

// Regression: when a checkout reuses an in-flight order (cartId + email match,
// e.g. card-prepare → switch to cash-on-delivery), the coupon was already
// redeemed on the existing doc. The routes correctly reuse
// `couponDiscountPercent` from that doc — but persisted `couponCode` straight
// from the NEW request body:
//   - body omits couponCode → `$set { couponCode: undefined }` → the Mongo
//     driver (ignoreUndefined defaults to false) serializes undefined as null,
//     WIPING the persisted code off the order doc;
//   - body carries a DIFFERENT code → the doc claims a code that was never
//     redeemed, at the old coupon's percent.
// The doc must keep the code that was actually redeemed.

const REDEEMED_CODE = 'SHOP-AAAA-BBBB';
const CART_ID = '00000000-0000-4000-8000-00000000c0de';

const {
  mockUpsertOrderByCartId,
  mockFindActiveOrderByCartId,
  mockUpdateOrderPayment,
  mockCreateRevolutOrder,
  mockCancelRevolutOrder,
  mockRedeemCoupon,
  mockMarkCartCompleted,
} = vi.hoisted(() => ({
  mockUpsertOrderByCartId: vi.fn(),
  mockFindActiveOrderByCartId: vi.fn(),
  mockUpdateOrderPayment: vi.fn().mockResolvedValue({ emailAlreadySent: false, matched: true }),
  mockCreateRevolutOrder: vi.fn().mockResolvedValue({
    id: 'rev_order_123',
    token: 'public_order_token_123',
    type: 'payment',
    state: 'pending',
    amount: 11920,
    currency: 'EUR',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }),
  mockCancelRevolutOrder: vi.fn().mockResolvedValue(undefined),
  mockRedeemCoupon: vi.fn().mockResolvedValue(null),
  mockMarkCartCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('resend', () => resendPackageModule());
vi.mock('@/lib/mongodb', () => mongoMock.module());

vi.mock('@/lib/contacts', () => ({
  upsertContact: vi.fn().mockResolvedValue(undefined),
  upsertOrderByCartId: mockUpsertOrderByCartId,
  findActiveOrderByCartId: mockFindActiveOrderByCartId,
  updateOrderPayment: mockUpdateOrderPayment,
  recordCapiPurchaseAttempt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/revolut', () => ({
  createRevolutOrder: mockCreateRevolutOrder,
  cancelRevolutOrder: mockCancelRevolutOrder,
}));

vi.mock('@/plugins/abandoned-cart/server/coupons', () => ({
  redeemCoupon: mockRedeemCoupon,
}));

vi.mock('@/plugins/abandoned-cart/server/carts', () => ({
  markCartCompleted: mockMarkCartCompleted,
}));

// The reuse path requires the cart cookie — override the setup.ts default
// (empty cookie store) with one that carries the cart id.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name: string) =>
      name === 'sf_cart_id' ? { name, value: CART_ID } : undefined,
    ),
    has: vi.fn((name: string) => name === 'sf_cart_id'),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.stubEnv('RESEND_API_KEY', 'test-key');

import { POST as postOrder } from '@/app/api/order/route';
import { POST as postCreateOrder } from '@/app/api/payments/revolut/create-order/route';

function existingActiveOrder() {
  return {
    _id: 'mongo-id-1',
    orderId: 'EXIST001',
    email: 'ion@test.ro',
    cartId: CART_ID,
    status: 'pending_payment',
    paymentMethod: 'card',
    couponCode: REDEEMED_CODE,
    couponDiscountPercent: 10,
  };
}

function orderBody(extra: Record<string, unknown> = {}) {
  return {
    shipping: buildShipping(),
    items: [buildCartItem()],
    totalPrice: 149,
    ...extra,
  };
}

function makeRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'shop.example.com' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
  mockFindActiveOrderByCartId.mockResolvedValue(existingActiveOrder());
  mockUpsertOrderByCartId.mockResolvedValue({
    orderId: 'EXIST001',
    reused: true,
    previous: existingActiveOrder(),
  });
  mockUpdateOrderPayment.mockResolvedValue({ emailAlreadySent: false, matched: true });
  mockRedeemCoupon.mockResolvedValue(null);
});

function persistedOrderData(): Record<string, unknown> {
  expect(mockUpsertOrderByCartId).toHaveBeenCalledTimes(1);
  return mockUpsertOrderByCartId.mock.calls[0][0].orderData as Record<string, unknown>;
}

describe('POST /api/order — coupon fields on order reuse', () => {
  it('keeps the redeemed couponCode when the retry body omits it', async () => {
    const res = await postOrder(makeRequest('http://shop.example.com/api/order', orderBody()));
    expect(res.status).toBe(200);

    const orderData = persistedOrderData();
    expect(orderData.couponDiscountPercent).toBe(10);
    // The code that was actually redeemed must survive the in-place update.
    expect(orderData.couponCode).toBe(REDEEMED_CODE);
  });

  it('does not overwrite the redeemed couponCode with a different, never-redeemed code', async () => {
    const res = await postOrder(
      makeRequest('http://shop.example.com/api/order', orderBody({ couponCode: 'SHOP-CCCC-DDDD' })),
    );
    expect(res.status).toBe(200);

    expect(mockRedeemCoupon).not.toHaveBeenCalled();
    const orderData = persistedOrderData();
    expect(orderData.couponDiscountPercent).toBe(10);
    expect(orderData.couponCode).toBe(REDEEMED_CODE);
  });
});

describe('POST /api/payments/revolut/create-order — coupon fields on order reuse', () => {
  it('keeps the redeemed couponCode when the re-prepare body omits it', async () => {
    const res = await postCreateOrder(
      makeRequest(
        'http://shop.example.com/api/payments/revolut/create-order',
        orderBody({ paymentMethod: 'card' }),
      ),
    );
    expect(res.status).toBe(200);

    const orderData = persistedOrderData();
    expect(orderData.couponDiscountPercent).toBe(10);
    expect(orderData.couponCode).toBe(REDEEMED_CODE);
  });

  it('does not overwrite the redeemed couponCode with a different code', async () => {
    const res = await postCreateOrder(
      makeRequest(
        'http://shop.example.com/api/payments/revolut/create-order',
        orderBody({ paymentMethod: 'card', couponCode: 'SHOP-CCCC-DDDD' }),
      ),
    );
    expect(res.status).toBe(200);

    expect(mockRedeemCoupon).not.toHaveBeenCalled();
    const orderData = persistedOrderData();
    expect(orderData.couponCode).toBe(REDEEMED_CODE);
  });
});
