/**
 * Issue #15 — orderId uniqueness guarantee.
 *
 * Order ids are 4 random bytes (8 hex chars) with no uniqueness guarantee:
 * a birthday collision silently merges two customers' orders (confirmation
 * page, admin detail, webhook updates all key on orderId). Fix:
 *   - unique index on `orders.orderId` (ensured once per process, like
 *     webhook-inbox / account-tokens), and
 *   - regenerate-on-duplicate (Mongo error 11000) with bounded retries when
 *     inserting an order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateIndex,
  mockFindOne,
  mockFindOneAndUpdate,
  mockInsertOne,
  mockUpdateOne,
} = vi.hoisted(() => ({
  mockCreateIndex: vi.fn(),
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockInsertOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      createIndex: mockCreateIndex,
      findOne: mockFindOne,
      findOneAndUpdate: mockFindOneAndUpdate,
      insertOne: mockInsertOne,
      updateOne: mockUpdateOne,
    }),
  }),
}));

vi.mock('@/lib/resend', () => ({ getResend: vi.fn() }));

function duplicateKeyError(): Error {
  return Object.assign(
    new Error('E11000 duplicate key error collection: storefront.orders index: orderId_1'),
    { code: 11000 },
  );
}

// Fresh module state per test: the ensure-index once-per-process flag lives
// at module level, so each test re-imports the modules.
async function loadModules() {
  const contacts = await import('@/lib/contacts');
  const orderId = await import('@/lib/orders/order-id');
  return { ...contacts, ...orderId };
}

beforeEach(() => {
  vi.resetModules();
  mockCreateIndex.mockReset().mockResolvedValue('orderId_1');
  mockFindOne.mockReset();
  mockFindOneAndUpdate.mockReset();
  mockInsertOne.mockReset().mockResolvedValue({ acknowledged: true });
  mockUpdateOne.mockReset().mockResolvedValue({ acknowledged: true });
});

describe('generateOrderId', () => {
  it('produces the historical 8-hex-uppercase format', async () => {
    const { generateOrderId } = await loadModules();
    for (let i = 0; i < 20; i++) {
      expect(generateOrderId()).toMatch(/^[0-9A-F]{8}$/);
    }
  });
});

describe('unique index on orders.orderId', () => {
  it('registers { orderId: 1 } unique before the first order insert', async () => {
    const { saveOrder } = await loadModules();
    await saveOrder('AAAA1111', 'a@b.ro', { status: 'received' });

    expect(mockCreateIndex).toHaveBeenCalledWith({ orderId: 1 }, { unique: true });
    // ensure-index runs once per process, not per write.
    await saveOrder('BBBB2222', 'a@b.ro', { status: 'received' });
    expect(mockCreateIndex).toHaveBeenCalledTimes(1);
  });

  it('does not block order writes if index creation fails (pre-existing duplicates)', async () => {
    mockCreateIndex.mockRejectedValue(new Error('IndexBuildAborted: duplicate key'));
    const { saveOrder } = await loadModules();

    await expect(saveOrder('AAAA1111', 'a@b.ro', {})).resolves.toBe('AAAA1111');
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
  });
});

describe('saveOrder — regenerate-on-duplicate', () => {
  it('returns the caller-provided orderId on the happy path', async () => {
    const { saveOrder } = await loadModules();
    await expect(saveOrder('AAAA1111', 'a@b.ro', { status: 'received' })).resolves.toBe('AAAA1111');
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
    expect(mockInsertOne.mock.calls[0][0]).toMatchObject({ orderId: 'AAAA1111', email: 'a@b.ro' });
  });

  it('regenerates the orderId and retries when the insert hits a duplicate key (11000)', async () => {
    mockInsertOne
      .mockRejectedValueOnce(duplicateKeyError())
      .mockResolvedValueOnce({ acknowledged: true });
    const { saveOrder } = await loadModules();

    const finalId = await saveOrder('AAAA1111', 'a@b.ro', { status: 'received' });

    expect(mockInsertOne).toHaveBeenCalledTimes(2);
    expect(finalId).toMatch(/^[0-9A-F]{8}$/);
    expect(finalId).not.toBe('AAAA1111');
    // The retried insert carries the regenerated id…
    expect(mockInsertOne.mock.calls[1][0]).toMatchObject({ orderId: finalId });
    // …and the contact mirror points at the id that actually landed.
    const contactUpdate = mockUpdateOne.mock.calls[0][1] as { $set: Record<string, unknown> };
    expect(contactUpdate.$set.lastOrderId).toBe(finalId);
  });

  it('gives up after 3 attempts when every insert collides', async () => {
    mockInsertOne.mockRejectedValue(duplicateKeyError());
    const { saveOrder } = await loadModules();

    await expect(saveOrder('AAAA1111', 'a@b.ro', {})).rejects.toMatchObject({ code: 11000 });
    expect(mockInsertOne).toHaveBeenCalledTimes(3);
    // No contact mirror update for an order that never persisted.
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('rethrows non-duplicate insert errors immediately without retrying', async () => {
    mockInsertOne.mockRejectedValue(Object.assign(new Error('network'), { code: 89 }));
    const { saveOrder } = await loadModules();

    await expect(saveOrder('AAAA1111', 'a@b.ro', {})).rejects.toThrow('network');
    expect(mockInsertOne).toHaveBeenCalledTimes(1);
  });
});

describe('upsertOrderByCartId — fallback insert path', () => {
  it('returns the REGENERATED orderId when the fallback insert collided, so the route confirms the real doc', async () => {
    mockFindOne.mockResolvedValueOnce(null); // no in-flight order for this cart
    mockInsertOne
      .mockRejectedValueOnce(duplicateKeyError())
      .mockResolvedValueOnce({ acknowledged: true });
    const { upsertOrderByCartId } = await loadModules();

    const result = await upsertOrderByCartId({
      cartId: 'cart-1',
      fallbackOrderId: 'AAAA1111',
      email: 'a@b.ro',
      orderData: { paymentMethod: 'cod', status: 'received', shipping: {} },
    });

    expect(result.reused).toBe(false);
    expect(result.orderId).toMatch(/^[0-9A-F]{8}$/);
    expect(result.orderId).not.toBe('AAAA1111');
    expect(mockInsertOne.mock.calls[1][0]).toMatchObject({ orderId: result.orderId });
  });

  it('in-place update path never touches orderId (unique index stays satisfied)', async () => {
    const existing = {
      _id: 'mongoId',
      orderId: 'EXISTING1',
      cartId: 'cart-1',
      status: 'pending_payment',
    };
    mockFindOne.mockResolvedValueOnce(existing);
    mockFindOneAndUpdate.mockResolvedValueOnce({ ...existing, status: 'received' });
    const { upsertOrderByCartId } = await loadModules();

    const result = await upsertOrderByCartId({
      cartId: 'cart-1',
      fallbackOrderId: 'WONTBEUSED',
      email: 'a@b.ro',
      orderData: { paymentMethod: 'cod', status: 'received', shipping: {} },
    });

    expect(result).toMatchObject({ orderId: 'EXISTING1', reused: true });
    const update = mockFindOneAndUpdate.mock.calls[0][1] as { $set: Record<string, unknown> };
    expect(update.$set).not.toHaveProperty('orderId');
    expect(mockInsertOne).not.toHaveBeenCalled();
  });
});
