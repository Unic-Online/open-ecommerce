import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared mock library — see src/__tests__/helpers/.
import { mongoMock } from './helpers/mongodb.mock';

vi.mock('@/lib/mongodb', () => mongoMock.module());

vi.mock('@/plugins/abandoned-cart/config', () => ({
  abandonedCartConfig: { testMode: false },
  isAbandonedCartDryRun: () => false,
}));

import { resetCartRecovery } from '@/plugins/abandoned-cart/server/recovery-cron';
import { CARTS_COLLECTION } from '@/plugins/abandoned-cart/shared/types';

// Re-bound after each `mongoMock.reset()`.
let mockFindOne: ReturnType<typeof mongoMock.collection>['findOne'];
let mockUpdateOne: ReturnType<typeof mongoMock.collection>['updateOne'];

describe('resetCartRecovery', () => {
  beforeEach(() => {
    mongoMock.reset();
    const carts = mongoMock.collection(CARTS_COLLECTION);
    mockFindOne = carts.findOne;
    mockUpdateOne = carts.updateOne;
  });

  it('returns unknown-cart when the doc is missing; no write', async () => {
    mockFindOne.mockResolvedValueOnce(null);

    const result = await resetCartRecovery('missing-id');

    expect(result).toEqual({ ok: false, reason: 'unknown-cart' });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('refuses to mutate completed carts; no write', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'completed-id',
      status: 'completed',
      items: [{ id: 'x', quantity: 1 } as never],
    });

    const result = await resetCartRecovery('completed-id');

    expect(result).toEqual({ ok: false, reason: 'completed' });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('zeroes recoveryStep + recoveryEmails and unsets couponCode for an abandoned cart with items', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-1',
      status: 'abandoned',
      items: [{ id: 'furniture__oslo-nightstand', quantity: 1 } as never],
      recoveryStep: 3,
      recoveryEmails: [
        { step: 1, sentAt: new Date(), messageId: 'a' },
        { step: 2, sentAt: new Date(), messageId: 'b' },
        { step: 3, sentAt: new Date(), messageId: 'c' },
      ],
      couponCode: 'SHOP-AAAA-BBBB',
    });

    const result = await resetCartRecovery('cart-1');

    expect(result).toEqual({ ok: true });
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = mockUpdateOne.mock.calls[0];
    expect(filter).toMatchObject({ cartId: 'cart-1', status: { $ne: 'completed' } });
    expect(update.$set).toMatchObject({
      recoveryStep: 0,
      recoveryEmails: [],
      status: 'abandoned',
    });
    expect(update.$set.abandonedAt).toBeInstanceOf(Date);
    expect(update.$unset).toMatchObject({ couponCode: '' });
  });

  it('flips empty cart to recovered without setting abandonedAt', async () => {
    mockFindOne.mockResolvedValueOnce({
      cartId: 'cart-2',
      status: 'recovered',
      items: [],
      recoveryStep: 2,
      recoveryEmails: [{ step: 1, sentAt: new Date() }],
    });

    const result = await resetCartRecovery('cart-2');

    expect(result).toEqual({ ok: true });
    const [, update] = mockUpdateOne.mock.calls[0];
    expect(update.$set.status).toBe('recovered');
    expect(update.$set.abandonedAt).toBeUndefined();
    expect(update.$unset.abandonedAt).toBe('');
  });
});
