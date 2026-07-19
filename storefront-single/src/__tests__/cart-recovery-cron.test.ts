/**
 * Unit tests for the cart-recovery cron engine: step transitions,
 * duplicate-send protection (the atomic recoveryStep filter), send-failure
 * rollback, coupon issue/reuse, and the forceAdvanceCart admin guards.
 *
 * Uses the shared helpers from `./helpers/`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mongoMock } from './helpers/mongodb.mock';
import { resendLibModule, sendEmailMock } from './helpers/resend.mock';
import { buildCart } from './helpers/builders';

const { mockIsDryRun, mockIssueCoupon } = vi.hoisted(() => ({
  mockIsDryRun: vi.fn(() => false),
  mockIssueCoupon: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => mongoMock.module());
vi.mock('@/lib/resend', () => resendLibModule());

vi.mock('@/plugins/abandoned-cart/config', () => ({
  abandonedCartConfig: { testMode: false },
  isAbandonedCartDryRun: mockIsDryRun,
}));

vi.mock('@/plugins/abandoned-cart/server/coupons', () => ({
  issueCoupon: mockIssueCoupon,
}));

vi.mock('@/plugins/abandoned-cart/server/recovery-token', () => ({
  signRecoveryToken: vi.fn((cartId: string) => `signed-${cartId}`),
}));

// Single-market template: absoluteUrl lives in `@/lib/market`, not in an
// i18n market-resolver. getMarketConfig is also re-exported from there.
vi.mock('@/lib/market', async () => {
  const actual = await vi.importActual<typeof import('@/lib/market')>('@/lib/market');
  return {
    ...actual,
    absoluteUrl: vi.fn((path: string) => `https://shop.example.com${path}`),
  };
});

import {
  runRecoveryCron,
  forceAdvanceCart,
} from '@/plugins/abandoned-cart/server/recovery-cron';
import { CARTS_COLLECTION } from '@/plugins/abandoned-cart/shared/types';

const carts = () => mongoMock.collection(CARTS_COLLECTION);

beforeEach(() => {
  mongoMock.reset();
  mockIsDryRun.mockReturnValue(false);
  mockIssueCoupon.mockResolvedValue({ code: 'SHOP-TEST-CODE', discountPercent: 10 });
  sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
  // A configured key + no dry-run flags ⇒ the cron really calls sendEmail,
  // so the at-most-once contract is observable on the mock.
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RECOVERY_EMAIL_DRY_RUN', '');
  vi.stubEnv('ABANDONED_CART_RECOVERY_EMAIL_ENABLED', '1');
});

describe('runRecoveryCron — step transitions', () => {
  it('returns zeros without touching the DB when the plugin is in dry-run (no Mongo)', async () => {
    mockIsDryRun.mockReturnValue(true);
    const result = await runRecoveryCron();
    expect(result).toEqual({
      abandoned: 0,
      step1Sent: 0,
      step2Sent: 0,
      step3Sent: 0,
      errors: [],
      dryRun: true,
    });
    expect(carts().updateMany).not.toHaveBeenCalled();
    expect(carts().find).not.toHaveBeenCalled();
  });

  it('flips stale active carts to abandoned — only those with an email and at least one item', async () => {
    carts().updateMany.mockResolvedValueOnce({ modifiedCount: 3 });
    const result = await runRecoveryCron();

    expect(result.abandoned).toBe(3);
    const [filter, update] = carts().updateMany.mock.calls[0];
    expect(filter).toMatchObject({
      status: 'active',
      email: { $exists: true, $type: 'string' },
      'items.0': { $exists: true },
    });
    expect(filter.lastActivityAt.$lt).toBeInstanceOf(Date);
    expect(update.$set.status).toBe('abandoned');
  });

  it('advances a step-0 cart to step 1 atomically and records the sent email', async () => {
    const cart = buildCart({ recoveryStep: 0 });
    // Only the step-1 query returns a candidate.
    carts().cursor.toArray
      .mockResolvedValueOnce([cart])
      .mockResolvedValue([]);
    carts().findOneAndUpdate.mockResolvedValueOnce({ ...cart, recoveryStep: 1 });

    const result = await runRecoveryCron();

    expect(result.step1Sent).toBe(1);
    expect(result.errors).toEqual([]);
    // Atomic advance gated on the PREVIOUS step + abandoned status — this is
    // the dedup contract (and the completed-cart resurrection guard).
    expect(carts().findOneAndUpdate).toHaveBeenCalledWith(
      { cartId: cart.cartId, recoveryStep: 0, status: 'abandoned' },
      { $set: { recoveryStep: 1 } },
      { returnDocument: 'after' },
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: [cart.email] }),
    );
    // recoveryEmails[] audit entry appended.
    const pushCall = carts().updateOne.mock.calls.find(([, u]) => u.$push);
    expect(pushCall?.[1].$push.recoveryEmails).toMatchObject({ step: 1 });
  });

  it('does NOT send when a concurrent caller already advanced the cart (atomic filter loses the race)', async () => {
    const cart = buildCart({ recoveryStep: 0 });
    carts().cursor.toArray
      .mockResolvedValueOnce([cart])
      .mockResolvedValue([]);
    // findOneAndUpdate returns null — someone else advanced first.
    carts().findOneAndUpdate.mockResolvedValueOnce(null);

    const result = await runRecoveryCron();

    expect(result.step1Sent).toBe(0);
    expect(result.errors).toEqual([]);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(carts().updateOne).not.toHaveBeenCalled();
  });

  it('a cart already at step 1 is not a step-1 candidate again — dedup via the recoveryStep filter', async () => {
    carts().cursor.toArray.mockResolvedValue([]);
    await runRecoveryCron();

    // Three find() calls: step 1, 2, 3 — each filtered on recoveryStep N-1.
    const stepFilters = carts().find.mock.calls.map(([f]) => f.recoveryStep);
    expect(stepFilters).toEqual([0, 1, 2]);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('rolls the step back when the email send fails, so the next tick retries', async () => {
    const cart = buildCart({ recoveryStep: 0 });
    carts().cursor.toArray
      .mockResolvedValueOnce([cart])
      .mockResolvedValue([]);
    carts().findOneAndUpdate.mockResolvedValueOnce({ ...cart, recoveryStep: 1 });
    sendEmailMock.mockRejectedValueOnce(new Error('resend 500'));

    const result = await runRecoveryCron();

    expect(result.step1Sent).toBe(0);
    expect(result.errors).toEqual([`step1 ${cart.cartId}: resend 500`]);
    // Rollback write: step 1 → 0, gated on the step we set.
    expect(carts().updateOne).toHaveBeenCalledWith(
      { cartId: cart.cartId, recoveryStep: 1 },
      { $set: { recoveryStep: 0 } },
    );
  });

  it('the atomic advance is gated on status:abandoned — a cart completed mid-tick is never resurrected', async () => {
    // Race: the candidate list is read at tick start; the customer can place
    // an order (markCartCompleted → status:'completed') before the advance
    // write runs. Without `status: 'abandoned'` in the atomic filter, the
    // advance matches on recoveryStep alone, flips the completed cart back to
    // 'abandoned', and emails a discount to someone who JUST paid.
    const cart = buildCart({ recoveryStep: 0 });
    carts().cursor.toArray
      .mockResolvedValueOnce([cart])
      .mockResolvedValue([]);
    // Honor the filter the way Mongo would for a doc completed mid-tick:
    // only a filter that excludes non-abandoned statuses returns null.
    carts().findOneAndUpdate.mockImplementationOnce(async (filter: Record<string, unknown>) =>
      filter.status === 'abandoned' ? null : { ...cart, recoveryStep: 1 },
    );

    const result = await runRecoveryCron();

    expect(result.step1Sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
    // And the filter itself must carry the status gate.
    expect(carts().findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: cart.cartId, recoveryStep: 0, status: 'abandoned' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('sends at most ONE recovery email per cart per tick — no H1+H24 cascade on a late tick', async () => {
    // With the daily Hobby cron, abandonedAt is set AT a tick, so 24h later
    // the cart passes both the step-1 (>1h) and step-2 (>24h) gates in the
    // same run. Step 2's fresh candidate query then re-finds the cart that
    // step 1 advanced seconds earlier and fires H24 on top of H1.
    const cart = buildCart({
      recoveryStep: 0,
      abandonedAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
    });
    carts().cursor.toArray
      .mockResolvedValueOnce([cart]) // step-1 candidates
      .mockResolvedValueOnce([{ ...cart, recoveryStep: 1 }]) // step-2 re-finds it
      .mockResolvedValueOnce([{ ...cart, recoveryStep: 2 }]); // step-3 re-finds it
    carts().findOneAndUpdate
      .mockResolvedValueOnce({ ...cart, recoveryStep: 1 })
      .mockResolvedValueOnce({ ...cart, recoveryStep: 2 })
      .mockResolvedValueOnce({ ...cart, recoveryStep: 3 });

    const result = await runRecoveryCron();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(result.step1Sent).toBe(1);
    expect(result.step2Sent).toBe(0);
    expect(result.step3Sent).toBe(0);
  });

  it('step 2 issues a coupon once and step 3 reuses the stored code', async () => {
    const step2Cart = buildCart({ cartId: 'cart-step2', recoveryStep: 1 });
    const step3Cart = buildCart({
      cartId: 'cart-step3',
      recoveryStep: 2,
      couponCode: 'SHOP-EXIS-TING',
    });
    carts().cursor.toArray
      .mockResolvedValueOnce([]) // step 1 candidates
      .mockResolvedValueOnce([step2Cart]) // step 2
      .mockResolvedValueOnce([step3Cart]); // step 3
    carts().findOneAndUpdate
      .mockResolvedValueOnce({ ...step2Cart, recoveryStep: 2 })
      .mockResolvedValueOnce({ ...step3Cart, recoveryStep: 3 });

    const result = await runRecoveryCron();

    expect(result.step2Sent).toBe(1);
    expect(result.step3Sent).toBe(1);
    // Coupon issued only for the cart without one.
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(mockIssueCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: 'cart-step2' }),
    );
    // The new code is persisted on the cart for step-3 reuse.
    expect(carts().updateOne).toHaveBeenCalledWith(
      { cartId: 'cart-step2' },
      { $set: { couponCode: 'SHOP-TEST-CODE' } },
    );
  });
});

describe('forceAdvanceCart — admin guards', () => {
  it.each([
    ['unknown-cart', null],
    ['completed', buildCart({ status: 'completed' })],
    ['recovered', buildCart({ status: 'recovered' })],
    ['no-email', buildCart({ email: undefined })],
    ['empty', buildCart({ items: [] })],
    ['max-step', buildCart({ recoveryStep: 3 })],
  ] as const)('refuses with reason %s', async (reason, doc) => {
    carts().findOne.mockResolvedValueOnce(doc);
    const result = await forceAdvanceCart('cart-x');
    expect(result).toEqual({ ok: false, reason });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('returns race-lost (not a double send) when the atomic advance loses', async () => {
    carts().findOne.mockResolvedValueOnce(buildCart({ recoveryStep: 1 }));
    carts().findOneAndUpdate.mockResolvedValueOnce(null);

    const result = await forceAdvanceCart('cart-x');

    expect(result).toEqual({ ok: false, reason: 'race-lost', error: undefined });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('promotes a fresh active cart to abandoned, then advances 0→1', async () => {
    const cart = buildCart({ status: 'active', recoveryStep: 0, abandonedAt: undefined });
    carts().findOne.mockResolvedValueOnce(cart);
    carts().findOneAndUpdate.mockResolvedValueOnce({ ...cart, recoveryStep: 1 });

    const result = await forceAdvanceCart(cart.cartId);

    expect(result).toMatchObject({ ok: true, fromStep: 0, toStep: 1 });
    expect(carts().updateOne).toHaveBeenCalledWith(
      { cartId: cart.cartId, status: 'active' },
      { $set: expect.objectContaining({ status: 'abandoned' }) },
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('dry-run mode short-circuits before any DB read', async () => {
    mockIsDryRun.mockReturnValue(true);
    const result = await forceAdvanceCart('cart-x');
    expect(result).toEqual({ ok: false, reason: 'dry-run' });
    expect(carts().findOne).not.toHaveBeenCalled();
  });
});
