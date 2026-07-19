import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFindOne,
  mockUpdateOne,
  mockInsertOne,
  mockCreateIndex,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn().mockResolvedValue({}),
  mockInsertOne: vi.fn().mockResolvedValue({}),
  mockCreateIndex: vi.fn().mockResolvedValue('idx'),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
      insertOne: mockInsertOne,
      createIndex: mockCreateIndex,
    }),
  }),
}));

import { upsertCart } from '@/plugins/abandoned-cart/server/carts';

const baseArgs = {
  cartId: 'cart-input-id',
  items: [
    {
      id: 'furniture__oslo-nightstand',
      productType: 'furniture' as const,
      productName: 'Oslo Nightstand',
      quantity: 1,
      unitPrice: 1899,
      slug: 'oslo-nightstand',
      shortName: 'Oslo Nightstand',
      image: '',
    },
  ],
  subtotal: 1899,
  marketingConsent: false,
};

describe('upsertCart rotation semantics', () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockUpdateOne.mockClear();
    mockInsertOne.mockClear();
  });

  it('inserts on a brand-new cartId via updateOne+upsert and does not rotate', async () => {
    mockFindOne.mockResolvedValueOnce(null);

    const result = await upsertCart(baseArgs);

    expect(result.cartId).toBe('cart-input-id');
    expect(result.rotated).toBe(false);
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockInsertOne).not.toHaveBeenCalled();
    const [filter, , options] = mockUpdateOne.mock.calls[0];
    expect(filter).toMatchObject({ cartId: 'cart-input-id' });
    expect(options).toMatchObject({ upsert: true });
  });

  it('updates an existing active cart in place; no rotation', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-input-id',
      status: 'active',
      items: [],
      lastActivityAt: new Date(),
    });

    const result = await upsertCart(baseArgs);

    expect(result.cartId).toBe('cart-input-id');
    expect(result.rotated).toBe(false);
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it('rotates to a fresh cartId and inserts a clean doc when existing cart is completed', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-input-id',
      status: 'completed',
      items: [],
      lastActivityAt: new Date(),
    });

    const result = await upsertCart(baseArgs);

    expect(result.rotated).toBe(true);
    expect(result.cartId).not.toBe('cart-input-id');
    expect(typeof result.cartId).toBe('string');
    expect(result.cartId.length).toBeGreaterThan(0);

    expect(mockInsertOne).toHaveBeenCalledTimes(1);
    expect(mockUpdateOne).not.toHaveBeenCalled();

    const [insertedDoc] = mockInsertOne.mock.calls[0];
    expect(insertedDoc.cartId).toBe(result.cartId);
    expect(insertedDoc.recoveryStep).toBe(0);
    expect(insertedDoc.recoveryEmails).toEqual([]);
    expect(insertedDoc.status).toBe('active');
  });
});

describe('upsertCart empty-items behavior', () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockUpdateOne.mockClear();
    mockInsertOne.mockClear();
  });

  const emptyArgs = { ...baseArgs, items: [], subtotal: 0 };

  it('no-ops on empty items when no existing doc — does not mint a noise row', async () => {
    mockFindOne.mockResolvedValueOnce(null);

    const result = await upsertCart(emptyArgs);

    expect(result.rotated).toBe(false);
    expect(mockUpdateOne).not.toHaveBeenCalled();
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it('no-ops on empty items when existing cart is completed — does not rotate', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-input-id',
      status: 'completed',
      items: [],
      lastActivityAt: new Date(),
    });

    const result = await upsertCart(emptyArgs);

    expect(result.rotated).toBe(false);
    expect(mockUpdateOne).not.toHaveBeenCalled();
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it('updates existing active cart with empty items but does NOT flip to recovered when no emails were sent', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-input-id',
      status: 'active',
      items: [{ id: 'x' }],
      recoveryEmails: [],
      lastActivityAt: new Date(),
    });

    await upsertCart(emptyArgs);

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [, update] = mockUpdateOne.mock.calls[0];
    expect(update.$set.status).toBeUndefined();
    expect(update.$set.recoveredAt).toBeUndefined();
  });

  it('flips to recovered on empty items when recovery emails were sent (legitimate user-recovered)', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-input-id',
      status: 'abandoned',
      items: [{ id: 'x' }],
      recoveryEmails: [{ step: 1, sentAt: new Date(), messageId: 'm1' }],
      lastActivityAt: new Date(),
    });

    await upsertCart(emptyArgs);

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [, update] = mockUpdateOne.mock.calls[0];
    expect(update.$set.status).toBe('recovered');
    expect(update.$set.recoveredAt).toBeInstanceOf(Date);
  });
});
