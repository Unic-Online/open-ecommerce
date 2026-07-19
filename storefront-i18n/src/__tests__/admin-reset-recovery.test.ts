import { describe, it, expect, vi } from 'vitest';
// Shared mock library + builders (issue #20) — see src/__tests__/helpers/.
import { mongoMock } from './helpers/mongodb.mock';
import { buildCart, buildCartItem } from './helpers/builders';

vi.mock('@/lib/mongodb', () => mongoMock.module());

vi.mock('@/plugins/abandoned-cart/config', () => ({
  abandonedCartConfig: { testMode: false },
  isAbandonedCartDryRun: () => false,
}));

import { resetCartRecovery } from '@/plugins/abandoned-cart/server/recovery-cron';
import { CARTS_COLLECTION } from '@/plugins/abandoned-cart/shared/types';

const carts = () => mongoMock.collection(CARTS_COLLECTION);

describe('resetCartRecovery', () => {
  it('returns unknown-cart when the doc is missing; no write', async () => {
    carts().findOne.mockResolvedValueOnce(null);

    const result = await resetCartRecovery('missing-id');

    expect(result).toEqual({ ok: false, reason: 'unknown-cart' });
    expect(carts().updateOne).not.toHaveBeenCalled();
  });

  it('refuses to mutate completed carts; no write', async () => {
    carts().findOne.mockResolvedValueOnce(
      buildCart({ cartId: 'completed-id', status: 'completed' }),
    );

    const result = await resetCartRecovery('completed-id');

    expect(result).toEqual({ ok: false, reason: 'completed' });
    expect(carts().updateOne).not.toHaveBeenCalled();
  });

  it('zeroes recoveryStep + recoveryEmails and unsets couponCode for an abandoned cart with items', async () => {
    carts().findOne.mockResolvedValueOnce(
      buildCart({
        cartId: 'cart-1',
        status: 'abandoned',
        items: [buildCartItem()],
        recoveryStep: 3,
        recoveryEmails: [
          { step: 1, sentAt: new Date(), messageId: 'a' },
          { step: 2, sentAt: new Date(), messageId: 'b' },
          { step: 3, sentAt: new Date(), messageId: 'c' },
        ],
        couponCode: 'SHOP-AAAA-BBBB',
      }),
    );

    const result = await resetCartRecovery('cart-1');

    expect(result).toEqual({ ok: true });
    expect(carts().updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = carts().updateOne.mock.calls[0];
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
    carts().findOne.mockResolvedValueOnce(
      buildCart({
        cartId: 'cart-2',
        status: 'recovered',
        items: [],
        recoveryStep: 2,
        recoveryEmails: [{ step: 1, sentAt: new Date() }],
      }),
    );

    const result = await resetCartRecovery('cart-2');

    expect(result).toEqual({ ok: true });
    const [, update] = carts().updateOne.mock.calls[0];
    expect(update.$set.status).toBe('recovered');
    expect(update.$set.abandonedAt).toBeUndefined();
    expect(update.$unset.abandonedAt).toBe('');
  });
});
