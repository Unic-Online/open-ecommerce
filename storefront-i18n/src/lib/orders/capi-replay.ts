/**
 * Meta CAPI Purchase replay engine — eligibility query + per-order resend loop.
 *
 * Why: the initial Purchase send (from /api/order for ramburs, from the
 * Revolut webhook for card) runs inside `after()`. A Vercel cold-freeze, a
 * transient network blip to graph.facebook.com, or a Meta 5xx silently drops
 * the event. Without a replay, that conversion is lost — Ads Manager misses
 * the signal, attribution is wrong, bidding degrades.
 *
 * Invariants:
 *   - Eligibility: marketingConsent === true (consent-denied is a permanent
 *     non-send), `metaCapi.purchase.sentAt` missing (success is terminal),
 *     createdAt within MAX_AGE_MS (Meta's attribution window),
 *     attempts < MAX_ATTEMPTS, and (ramburs+received) OR (card+paid) —
 *     never fire for unpaid card.
 *   - Idempotency: shared event_id = orderId. Meta dedupes within 7 days, so
 *     a replay that races with a late successful initial send is harmless.
 *   - One order failing (send OR bookkeeping) never aborts the batch.
 * Side effects: outbound Graph API sends, Mongo attempt bookkeeping, error sink.
 * Caller contract: caller owns auth (cron secret) and passes a connected Db.
 */
import type { Db, Document } from 'mongodb';
import { ORDERS_COLLECTION } from '@/lib/orders/types';
import { sendServerPurchase, type MetaBrowserTrackingData } from '@/lib/meta-capi';
import { recordCapiPurchaseAttempt } from '@/lib/contacts';
import { captureError } from '@/lib/error-sink';
import { DEFAULT_MARKET, getMarketConfig, type MarketKey } from '@/i18n/market-config';
import { absoluteUrl } from '@/i18n/market-resolver';
import {
  checkoutPaymentExperimentParams,
  normalizeCheckoutPaymentVariant,
} from '@/lib/ab-testing';
import type { ShippingData, OrderItem } from '@/lib/validation';

export const MAX_ATTEMPTS = 5;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const BATCH_LIMIT = 100;

export interface CapiReplaySummary {
  ok: true;
  candidates: number;
  sent: number;
  failed: number;
  cutoff: string;
}

/** Mongo filter selecting orders whose Purchase CAPI send is still owed. */
export function buildEligibilityFilter(cutoff: Date): Document {
  return {
    marketingConsent: true,
    'metaCapi.purchase.sentAt': { $exists: false },
    createdAt: { $gte: cutoff },
    $and: [
      {
        $or: [
          { 'metaCapi.purchase.attempts': { $exists: false } },
          { 'metaCapi.purchase.attempts': { $lt: MAX_ATTEMPTS } },
        ],
      },
      {
        $or: [
          { paymentMethod: 'ramburs', status: 'received' },
          { paymentMethod: 'card', status: 'paid' },
        ],
      },
    ],
  };
}

export async function runCapiReplay(
  db: Db,
  opts: { now?: Date } = {},
): Promise<CapiReplaySummary> {
  const cutoff = new Date((opts.now?.getTime() ?? Date.now()) - MAX_AGE_MS);

  const eligible = await db
    .collection(ORDERS_COLLECTION)
    .find(buildEligibilityFilter(cutoff))
    .limit(BATCH_LIMIT)
    .toArray();

  let sent = 0;
  let failed = 0;

  for (const order of eligible) {
    const orderIdStr = order.orderId as string;
    try {
      const orderMarket = (order.market as MarketKey | undefined) ?? DEFAULT_MARKET;
      const shipping = order.shipping as ShippingData;
      const items = order.items as OrderItem[];
      const total = order.totalPrice as number;
      const experiments = order.experiments as { checkoutPaymentUi?: string } | undefined;
      const checkoutPaymentUi =
        normalizeCheckoutPaymentVariant(experiments?.checkoutPaymentUi) ?? 'control';
      const tracking = (order.tracking as MetaBrowserTrackingData | undefined) ?? undefined;
      const testEventCode =
        typeof order.testEventCode === 'string' ? (order.testEventCode as string) : undefined;

      const result = await sendServerPurchase({
        orderId: orderIdStr,
        shipping,
        clientIp: (order.clientIp as string | undefined) ?? undefined,
        clientUserAgent: (order.clientUserAgent as string | undefined) ?? undefined,
        totalPrice: total,
        // Order currency persisted at order time; legacy docs fall back to
        // the order market's config currency.
        currency:
          (order.currency as string | undefined) ?? getMarketConfig(orderMarket).currency,
        contentIds: items.map((item) => item.id),
        numItems: items.reduce((sum, item) => sum + item.quantity, 0),
        contentName: items.map((item) => item.productName).join(', '),
        shippingCost: order.shippingCost as number | undefined,
        eventSourceUrl: absoluteUrl(`/confirmare/${orderIdStr}`, orderMarket),
        tracking,
        customData: checkoutPaymentExperimentParams(checkoutPaymentUi),
        marketingConsent: true,
        testEventCode,
      });
      await recordCapiPurchaseAttempt(orderIdStr, result);
      if (result.ok) sent++;
      else failed++;
    } catch (err) {
      captureError(err, { orderId: orderIdStr }, { tag: 'meta_capi_replay' });
      failed++;
    }
  }

  // Alert: a replay is the last safety net for these conversions — if it
  // still fails, the operator must hear about it (not just a cron 200).
  if (failed > 0) {
    captureError(
      new Error(`Meta CAPI replay finished with ${failed} failed order(s)`),
      { candidates: eligible.length, sent, failed },
      { tag: 'meta_capi_replay' },
    );
  }

  return {
    ok: true,
    candidates: eligible.length,
    sent,
    failed,
    cutoff: cutoff.toISOString(),
  };
}
