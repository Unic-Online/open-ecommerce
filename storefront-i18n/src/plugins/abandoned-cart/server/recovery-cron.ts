/**
 * Cart-recovery cron: H1 / H24 / H72 email sequence + admin force-advance.
 *
 * Invariants:
 *   - Idempotency: `recoveryStep` advance is atomic (`findOneAndUpdate` filtered on the previous step). Concurrent cron + admin = one winner per cart per step.
 *   - On send failure, the step is rolled back so the next tick retries — emails are at-most-once via `recoveryEmails[]`, not at-least-once.
 *   - `testMode` thresholds use minutes (1/2/3); production uses hours (1/24/72).
 *   - `PER_TICK_LIMIT=50` is sized for Vercel Hobby cron (every 15 min) × Resend rate limits — do not raise without checking both.
 *   - Dry-run gates send logging but still advance state, so e2e and local QA exercise the timing logic without an API key.
 * Side effects: writes to `carts` collection, emits Resend emails, may issue coupons via `issueCoupon`.
 * Caller contract: only the Vercel cron route and `/admin/cart/[cartId]` should invoke these; the cron route is also rate-limited by Vercel itself.
 */
import { serverEnv } from '@/env';
import { getDb } from '@/lib/mongodb';
import { sendEmail } from '@/lib/resend';
import { absoluteUrl } from '@/i18n/market-resolver';
import { DEFAULT_MARKET, getMarketConfig, type MarketKey } from '@/i18n/market-config';
import { CARTS_COLLECTION, type CartDoc } from '../shared/types';
import { abandonedCartConfig, isAbandonedCartDryRun } from '../config';
import { issueCoupon } from './coupons';
import {
  renderRecoveryH1,
  renderRecoveryH24,
  renderRecoveryH72,
  type RecoveryEmail,
} from './emails/cart-recovery';
import { signRecoveryToken } from './recovery-token';

// Coupon discount sent in H24/H72 emails. Stacks on the default 10% welcome
// discount in pricing.ts, so total = 20% off when redeemed.
const COUPON_DISCOUNT_PERCENT = 10;

// Email-send batch size per cron tick. Vercel Hobby cron runs every 15 min,
// 50 sends per tick = 200/h, well below any sane Resend rate limit.
const PER_TICK_LIMIT = 50;

export interface RecoveryCronResult {
  abandoned: number;
  step1Sent: number;
  step2Sent: number;
  step3Sent: number;
  errors: string[];
  dryRun: boolean;
}

interface Thresholds {
  abandonAfterMs: number;
  h1AfterMs: number;
  h24AfterMs: number;
  h72AfterMs: number;
}

function thresholds(): Thresholds {
  // Why: testMode collapses hours→minutes so the e2e suite can exercise the
  // full H1/H24/H72 sequence in a single Playwright spec without sleeping
  // for 4 days. Production uses real time gates; test gates the same
  // step-advance code via shrunken thresholds, not a different code path.
  if (abandonedCartConfig.testMode) {
    return {
      abandonAfterMs: 60_000,        // 1 min
      h1AfterMs: 60_000,             // +1 min after abandonment
      h24AfterMs: 2 * 60_000,        // +2 min
      h72AfterMs: 3 * 60_000,        // +3 min
    };
  }
  return {
    abandonAfterMs: 60 * 60_000,
    h1AfterMs: 60 * 60_000,
    h24AfterMs: 24 * 60 * 60_000,
    h72AfterMs: 72 * 60 * 60_000,
  };
}

function isDryRun(): boolean {
  // Dry run: log the intent, advance the recoveryStep, but skip Resend.
  // Useful for local QA without an API key and for the e2e suite.
  return (
    serverEnv.RECOVERY_EMAIL_DRY_RUN === '1' ||
    serverEnv.ABANDONED_CART_RECOVERY_EMAIL_ENABLED === '0' ||
    !serverEnv.RESEND_API_KEY
  );
}

async function sendOne(to: string, email: RecoveryEmail, market: MarketKey): Promise<string | undefined> {
  if (isDryRun()) {
    console.log(`[recovery-email DRY_RUN] would send "${email.subject}" to ${to}`);
    return 'dry-run';
  }
  const result = await sendEmail({
    from: getMarketConfig(market).contact.fromEmail,
    to: [to],
    subject: email.subject,
    html: email.html,
  });
  return result.data?.id;
}

function recoveryUrlFor(cart: CartDoc): string {
  const token = signRecoveryToken(cart.cartId);
  // Phase 3: link to the domain the cart was created on. Pre-Phase-3 docs
  // lack `market` and fall through to DEFAULT_MARKET (RO), which matches
  // the historical SITE_URL behavior.
  return absoluteUrl(`/recover/${token}`, cart.market ?? DEFAULT_MARKET);
}

function firstNameFromShipping(cart: CartDoc): string | undefined {
  // Phase 4 binds shipping fields to the cart via /api/cart/sync. For now
  // just leave it undefined so the email opens with a neutral greeting.
  void cart;
  return undefined;
}

export async function runRecoveryCron(): Promise<RecoveryCronResult> {
  const t = thresholds();
  const now = Date.now();
  const result: RecoveryCronResult = {
    abandoned: 0,
    step1Sent: 0,
    step2Sent: 0,
    step3Sent: 0,
    errors: [],
    dryRun: isDryRun(),
  };

  // No DB → nothing to advance. Return zeros with dryRun: true so callers
  // (e.g. the cron route in test environments) get a well-formed response.
  if (isAbandonedCartDryRun()) {
    result.dryRun = true;
    return result;
  }

  const db = await getDb();
  const carts = db.collection<CartDoc>(CARTS_COLLECTION);

  // Step 0: flip qualifying active carts to 'abandoned'.
  const abandonRes = await carts.updateMany(
    {
      status: 'active',
      email: { $exists: true, $type: 'string' },
      'items.0': { $exists: true },
      lastActivityAt: { $lt: new Date(now - t.abandonAfterMs) },
    },
    { $set: { status: 'abandoned', abandonedAt: new Date() } },
  );
  result.abandoned = abandonRes.modifiedCount ?? 0;

  // Helpers for steps 1/2/3. Each step picks up to PER_TICK_LIMIT carts at
  // recoveryStep N-1 whose abandonedAt is older than the step's threshold,
  // and advances them to N atomically.
  //
  // Invariant: at most ONE recovery email per cart per tick. abandonedAt is
  // set at a cron tick, so on a daily schedule the next tick lands exactly
  // one threshold-multiple later and a cart can pass the step-1 AND step-2
  // gates in the same run (or all three after cron downtime). Step 2's
  // fresh candidate query would re-find the cart step 1 advanced seconds
  // earlier — without this exclusion the customer gets H1+H24 (or the full
  // funnel) within one minute.
  const advancedThisTick = new Set<string>();
  const stepAdvance = async (stepN: 1 | 2 | 3, withCoupon: boolean) => {
    const olderThan = new Date(
      now - (stepN === 1 ? t.h1AfterMs : stepN === 2 ? t.h24AfterMs : t.h72AfterMs),
    );

    const candidates = await carts
      .find({
        status: 'abandoned',
        recoveryStep: (stepN - 1) as 0 | 1 | 2,
        abandonedAt: { $lte: olderThan },
        email: { $exists: true, $type: 'string' },
        'items.0': { $exists: true },
        ...(advancedThisTick.size > 0
          ? { cartId: { $nin: [...advancedThisTick] } }
          : {}),
      })
      .limit(PER_TICK_LIMIT)
      .toArray();

    let sent = 0;
    for (const cart of candidates) {
      if (advancedThisTick.has(cart.cartId)) continue;
      const ok = await advanceCartToStep(cart, stepN, withCoupon);
      if (ok.advanced) {
        sent++;
        advancedThisTick.add(cart.cartId);
      }
      if (ok.error) result.errors.push(`step${stepN} ${cart.cartId}: ${ok.error}`);
    }
    return sent;
  };

  result.step1Sent = await stepAdvance(1, false);
  result.step2Sent = await stepAdvance(2, true);
  result.step3Sent = await stepAdvance(3, true);

  return result;
}

/**
 * Advance a single cart to a specific recovery step. The atomic
 * findOneAndUpdate gates on the previous step so concurrent calls (e.g. an
 * admin force-advance happening at the same time as the cron) can't
 * double-send. Returns { advanced: false } if a concurrent caller won the
 * race or the cart was already at/past the target step.
 *
 * Used by both runRecoveryCron (for time-gated mass advancement) and
 * forceAdvanceCart (for admin one-off triggers).
 */
async function advanceCartToStep(
  cart: CartDoc,
  stepN: 1 | 2 | 3,
  withCoupon: boolean,
): Promise<{ advanced: boolean; error?: string; messageId?: string; couponCode?: string }> {
  const db = await getDb();
  const carts = db.collection<CartDoc>(CARTS_COLLECTION);

  if (!cart.email) {
    return { advanced: false, error: 'cart has no email bound' };
  }
  if (cart.items.length === 0) {
    return { advanced: false, error: 'cart is empty' };
  }

  // Atomic advance: filter on the previous step guarantees one winner per
  // cart per (target step). If a concurrent caller already advanced past
  // the previous step, this returns null and we bail out.
  //
  // Atomic: `status: 'abandoned'` must be part of THIS filter, not just the
  // candidate query — the candidate list is read at tick start, and the
  // customer can complete the order (or come back, flipping the cart to
  // 'active') before this write runs. Filtering on recoveryStep alone would
  // resurrect a completed cart to 'abandoned' and email a discount to
  // someone who just paid.
  const advanced = await carts.findOneAndUpdate(
    {
      cartId: cart.cartId,
      recoveryStep: (stepN - 1) as 0 | 1 | 2,
      status: 'abandoned',
    },
    { $set: { recoveryStep: stepN } },
    { returnDocument: 'after' },
  );
  if (!advanced) return { advanced: false };

  try {
    let couponCode: string | undefined;
    if (withCoupon) {
      // Reuse an existing coupon if one was issued earlier (step 2 issues,
      // step 3 reuses the same code so the user sees consistency).
      if (cart.couponCode) {
        couponCode = cart.couponCode;
      } else {
        const coupon = await issueCoupon({
          cartId: cart.cartId,
          email: cart.email,
          discountPercent: COUPON_DISCOUNT_PERCENT,
        });
        couponCode = coupon.code;
        await carts.updateOne(
          { cartId: cart.cartId },
          { $set: { couponCode: coupon.code } },
        );
      }
    }

    const recoveryUrl = recoveryUrlFor(cart);
    const cartMarket = (cart.market as MarketKey | undefined) ?? DEFAULT_MARKET;
    const params = {
      recoveryUrl,
      items: cart.items,
      firstName: firstNameFromShipping(cart),
      couponCode,
      couponDiscountPercent: couponCode ? COUPON_DISCOUNT_PERCENT : undefined,
      market: cartMarket,
    };
    const email =
      stepN === 1
        ? renderRecoveryH1(params)
        : stepN === 2
        ? renderRecoveryH24(params)
        : renderRecoveryH72(params);

    const messageId = await sendOne(cart.email, email, cartMarket);
    await carts.updateOne(
      { cartId: cart.cartId },
      {
        $push: {
          recoveryEmails: {
            step: stepN,
            sentAt: new Date(),
            messageId,
          },
        },
      },
    );
    return { advanced: true, messageId, couponCode };
  } catch (err) {
    // Roll back the step so the cron tick retries this cart.
    await carts.updateOne(
      { cartId: cart.cartId, recoveryStep: stepN },
      { $set: { recoveryStep: (stepN - 1) as 0 | 1 | 2 } },
    );
    const msg = err instanceof Error ? err.message : String(err);
    return { advanced: false, error: msg };
  }
}

export type ForceAdvanceReason =
  | 'unknown-cart'
  | 'completed'
  | 'recovered'
  | 'no-email'
  | 'empty'
  | 'max-step'
  | 'race-lost'
  | 'dry-run';

export interface ForceAdvanceResult {
  ok: boolean;
  fromStep?: 0 | 1 | 2 | 3;
  toStep?: 1 | 2 | 3;
  couponCode?: string;
  messageId?: string;
  reason?: ForceAdvanceReason;
  error?: string;
}

/**
 * Admin one-shot: advance a single cart by one step, ignoring time gates.
 * Used by /admin/cart/[cartId] for manual QA — replaces the wait for the
 * 15-min Vercel Cron tick. Concurrent calls (or a cron tick happening at
 * the same moment) lose the atomic findOneAndUpdate race and return
 * { ok: false, reason: 'race-lost' } so we never double-send.
 *
 * If the cart is in 'active' status with items + email, we promote it to
 * 'abandoned' first so the recovery sequence can begin.
 */
export async function forceAdvanceCart(cartId: string): Promise<ForceAdvanceResult> {
  if (isAbandonedCartDryRun()) {
    return { ok: false, reason: 'dry-run' };
  }

  const db = await getDb();
  const carts = db.collection<CartDoc>(CARTS_COLLECTION);

  const cart = await carts.findOne({ cartId });
  if (!cart) return { ok: false, reason: 'unknown-cart' };
  if (cart.status === 'completed') return { ok: false, reason: 'completed' };
  if (cart.status === 'recovered') return { ok: false, reason: 'recovered' };
  if (!cart.email) return { ok: false, reason: 'no-email' };
  if (cart.items.length === 0) return { ok: false, reason: 'empty' };
  if (cart.recoveryStep >= 3) return { ok: false, reason: 'max-step' };

  const fromStep = cart.recoveryStep;
  const toStep = (cart.recoveryStep + 1) as 1 | 2 | 3;
  const withCoupon = toStep === 2 || toStep === 3;

  // If the cart is still 'active', the cron's first updateMany would
  // promote it to 'abandoned' before sending step 1. We do the same here
  // so a manual force-advance from step 0 works on a fresh active cart.
  if (cart.status === 'active') {
    await carts.updateOne(
      { cartId, status: 'active' },
      { $set: { status: 'abandoned', abandonedAt: cart.abandonedAt ?? new Date() } },
    );
    cart.status = 'abandoned';
    if (!cart.abandonedAt) cart.abandonedAt = new Date();
  }

  const result = await advanceCartToStep(cart, toStep, withCoupon);
  if (!result.advanced) {
    return {
      ok: false,
      reason: result.error ? undefined : 'race-lost',
      error: result.error,
    };
  }
  return {
    ok: true,
    fromStep,
    toStep,
    couponCode: result.couponCode,
    messageId: result.messageId,
  };
}

export type ResetRecoveryReason = 'unknown-cart' | 'completed' | 'dry-run';

export interface ResetRecoveryResult {
  ok: boolean;
  reason?: ResetRecoveryReason;
}

/**
 * Admin one-shot: clear a cart's recovery state so the funnel can run again.
 * Zeroes recoveryStep, drops recoveryEmails[], and unsets couponCode +
 * abandonedAt. If the cart still has items, status flips to 'abandoned' with
 * a fresh abandonedAt so the cron picks it up on the next tick (and admin
 * force-advance can re-run 1→2→3). Empty carts stay 'recovered'.
 *
 * Hard-rejects 'completed' carts — those are order-linked audit records and
 * must never be mutated.
 */
export async function resetCartRecovery(cartId: string): Promise<ResetRecoveryResult> {
  if (isAbandonedCartDryRun()) {
    return { ok: false, reason: 'dry-run' };
  }

  const db = await getDb();
  const carts = db.collection<CartDoc>(CARTS_COLLECTION);

  const cart = await carts.findOne({ cartId });
  if (!cart) return { ok: false, reason: 'unknown-cart' };
  if (cart.status === 'completed') return { ok: false, reason: 'completed' };

  const now = new Date();
  const hasItems = cart.items.length > 0;

  await carts.updateOne(
    { cartId, status: { $ne: 'completed' } },
    {
      $set: {
        recoveryStep: 0,
        recoveryEmails: [],
        status: hasItems ? 'abandoned' : 'recovered',
        ...(hasItems ? { abandonedAt: now } : {}),
        lastActivityAt: now,
      },
      $unset: {
        couponCode: '',
        ...(hasItems ? { recoveredAt: '' } : { abandonedAt: '' }),
      },
    },
  );

  return { ok: true };
}
