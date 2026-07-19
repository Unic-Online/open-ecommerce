import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFindOneAndUpdate: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      findOneAndUpdate: mockFindOneAndUpdate,
    }),
  }),
}));

vi.mock('@/lib/resend', () => ({
  getResend: vi.fn(),
}));

import { updateOrderPayment } from '@/lib/contacts';

describe('updateOrderPayment terminal-state guard', () => {
  beforeEach(() => mockFindOneAndUpdate.mockReset());

  it('always includes $nin: [cancelled, refunded] in the filter', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X', status: 'paid' });
    await updateOrderPayment('X', 'paid', { state: 'completed' });

    const [filter] = mockFindOneAndUpdate.mock.calls[0];
    const guards = (filter as { $and: Array<{ status?: { $nin?: string[] } }> }).$and;
    const ninGuard = guards.find((g) => g.status && '$nin' in g.status);
    expect(ninGuard).toBeDefined();
    expect(new Set(ninGuard!.status!.$nin!)).toEqual(new Set(['cancelled', 'refunded']));
  });

  it('returns matched=false when filter does not match (e.g. doc is in terminal state)', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce(null);
    const result = await updateOrderPayment('X', 'paid', { state: 'completed' });
    expect(result).toMatchObject({ matched: false });
  });

  it('layers $in: expectedFromStatus when provided', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X', status: 'paid' });
    await updateOrderPayment('X', 'paid', { state: 'completed' }, {
      expectedFromStatus: ['pending_payment'],
    });
    const [filter] = mockFindOneAndUpdate.mock.calls[0];
    const guards = (filter as {
      $and: Array<{ status?: { $nin?: string[]; $in?: string[] } }>;
    }).$and;
    const inGuard = guards.find((g) => g.status && '$in' in g.status);
    expect(inGuard?.status?.$in).toEqual(['pending_payment']);
  });

  it("accepts the new 'refunded' status value", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X', status: 'refunded' });
    const result = await updateOrderPayment('X', 'refunded', {});
    expect(result.matched).toBe(true);
    const [, update] = mockFindOneAndUpdate.mock.calls[0];
    const set = (update as { $set: Record<string, unknown> }).$set;
    expect(set.status).toBe('refunded');
  });

  it('still atomically sets emailSentAt only on first call when markEmailSent is true', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X', status: 'paid' });
    await updateOrderPayment('X', 'paid', { state: 'completed' }, { markEmailSent: true });
    const [filter, update] = mockFindOneAndUpdate.mock.calls[0];
    expect((filter as { emailSentAt: unknown }).emailSentAt).toEqual({ $exists: false });
    const set = (update as { $set: Record<string, unknown> }).$set;
    expect(set.emailSentAt).toBeInstanceOf(Date);
  });

  it("layers paymentMethod: 'card' when expectedPaymentMethod is provided", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X', status: 'paid' });
    await updateOrderPayment('X', 'paid', { state: 'completed' }, {
      expectedPaymentMethod: 'card',
    });
    const [filter] = mockFindOneAndUpdate.mock.calls[0];
    const guards = (filter as {
      $and: Array<{ paymentMethod?: string; status?: { $nin?: string[] } }>;
    }).$and;
    const pmGuard = guards.find((g) => g.paymentMethod !== undefined);
    expect(pmGuard).toEqual({ paymentMethod: 'card' });
  });

  it('returns matched=false when paymentMethod has been switched (e.g. card→ramburs)', async () => {
    // Simulates: webhook arrives for an order whose customer flipped to ramburs.
    // Mongo's filter rejects (paymentMethod: 'card' no longer matches), so the
    // findOneAndUpdate returns null and the webhook short-circuits.
    mockFindOneAndUpdate.mockResolvedValueOnce(null);
    const result = await updateOrderPayment('X', 'paid', { state: 'completed' }, {
      expectedPaymentMethod: 'card',
      markEmailSent: true,
    });
    expect(result).toEqual({ matched: false, emailAlreadySent: true });
  });
});
