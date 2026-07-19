import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindOne,
  mockFindOneAndUpdate,
  mockInsertOne,
  mockUpdateOne,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockInsertOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      findOne: mockFindOne,
      findOneAndUpdate: mockFindOneAndUpdate,
      insertOne: mockInsertOne,
      updateOne: mockUpdateOne,
    }),
  }),
}));

vi.mock('@/lib/resend', () => ({ getResend: vi.fn() }));

import { upsertOrderByCartId, findActiveOrderByCartId } from '@/lib/contacts';

describe('upsertOrderByCartId', () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockInsertOne.mockReset();
    mockUpdateOne.mockReset();
  });

  it('inserts a fresh order doc when no existing non-terminal order matches the cart', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    mockInsertOne.mockResolvedValueOnce({});
    mockUpdateOne.mockResolvedValueOnce({});

    const result = await upsertOrderByCartId({
      cartId: 'cart-1',
      fallbackOrderId: 'NEWORDER',
      email: 'a@b.ro',
      orderData: { paymentMethod: 'card', status: 'pending_payment', shipping: {} },
    });

    expect(result).toEqual({ orderId: 'NEWORDER', reused: false });
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('updates the existing non-terminal order in place and reuses its orderId', async () => {
    const existing = {
      _id: 'mongoId',
      orderId: 'EXISTING1',
      cartId: 'cart-1',
      status: 'pending_payment',
      paymentMethod: 'card',
      payment: { providerOrderId: 'rev_123' },
    };
    mockFindOne.mockResolvedValueOnce(existing);
    mockFindOneAndUpdate.mockResolvedValueOnce({ ...existing, paymentMethod: 'cod', status: 'received' });

    const result = await upsertOrderByCartId({
      cartId: 'cart-1',
      fallbackOrderId: 'WONTBEUSED',
      email: 'a@b.ro',
      orderData: { paymentMethod: 'cod', status: 'received', shipping: {} },
    });

    expect(result.orderId).toBe('EXISTING1');
    expect(result.reused).toBe(true);
    expect(result.previous).toEqual(existing);
    expect(mockInsertOne).not.toHaveBeenCalled();
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: 'mongoId', cartId: 'cart-1' });
    expect((filter as { status: { $in: string[] } }).status.$in).toEqual(
      expect.arrayContaining(['pending_payment', 'received']),
    );
    const set = (update as { $set: Record<string, unknown> }).$set;
    expect(set.paymentMethod).toBe('cod');
    expect(set.status).toBe('received');
  });

  it('inserts when cartId is missing entirely (pre-cookie visitors)', async () => {
    mockInsertOne.mockResolvedValueOnce({});
    mockUpdateOne.mockResolvedValueOnce({});

    const result = await upsertOrderByCartId({
      cartId: undefined,
      fallbackOrderId: 'NOCART01',
      email: 'a@b.ro',
      orderData: { paymentMethod: 'cod', status: 'received', shipping: {} },
    });

    expect(result).toEqual({ orderId: 'NOCART01', reused: false });
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
  });

  it('falls back to insert when the existing doc moves to terminal between findOne and findOneAndUpdate', async () => {
    mockFindOne.mockResolvedValueOnce({
      _id: 'mongoId',
      orderId: 'WASPAID1',
      cartId: 'cart-1',
      status: 'pending_payment',
    });
    // The race: findOneAndUpdate finds nothing (doc moved to 'paid' between calls).
    mockFindOneAndUpdate.mockResolvedValueOnce(null);
    mockInsertOne.mockResolvedValueOnce({});
    mockUpdateOne.mockResolvedValueOnce({});

    const result = await upsertOrderByCartId({
      cartId: 'cart-1',
      fallbackOrderId: 'NEWFRESH',
      email: 'a@b.ro',
      orderData: { paymentMethod: 'cod', status: 'received', shipping: {} },
    });

    expect(result).toEqual({ orderId: 'NEWFRESH', reused: false });
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
  });
});

describe('findActiveOrderByCartId', () => {
  beforeEach(() => {
    mockFindOne.mockReset();
  });

  it('returns null when cartId is empty', async () => {
    const result = await findActiveOrderByCartId('', 'ion@test.ro');
    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('returns null when email is empty (cartId without an owner is meaningless)', async () => {
    const result = await findActiveOrderByCartId('cart-1', '');
    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('queries on cartId + lowercased email + non-terminal statuses, sorted newest first', async () => {
    mockFindOne.mockResolvedValueOnce({ orderId: 'X', status: 'pending_payment' });
    await findActiveOrderByCartId('cart-1', 'Ion@Test.RO');
    expect(mockFindOne).toHaveBeenCalledTimes(1);
    const [filter, options] = mockFindOne.mock.calls[0];
    expect((filter as { cartId: string }).cartId).toBe('cart-1');
    expect((filter as { email: string }).email).toBe('ion@test.ro');
    expect((filter as { status: { $in: string[] } }).status.$in).toEqual(
      expect.arrayContaining(['pending_payment', 'received']),
    );
    expect(options).toMatchObject({ sort: { createdAt: -1 } });
  });
});
