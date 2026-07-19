/**
 * Post-delivery review-request cron — eligibility query + per-order send loop.
 *
 * Why: genuine customer reviews should gradually replace the seeded ones.
 * Once an order's fulfillment reaches `delivered`, we wait a few days (so the
 * product has actually been used) and send ONE email inviting a review per
 * purchased product, linking into that product page's reviews section.
 *
 * Invariants:
 *   - Eligibility: `fulfillment.status === 'delivered'`, `deliveredAt` between
 *     `REVIEW_REQUEST_DELAY_DAYS` and `REVIEW_REQUEST_MAX_AGE_DAYS` ago (the
 *     upper bound keeps a first deploy from emailing months-old deliveries),
 *     `fulfillment.reviewEmailSentAt` missing, order not cancelled/refunded.
 *   - Idempotency: `markReviewEmailSent` is called ONLY once the send
 *     succeeds — mirrors `markShipmentEmailSent`/`setFulfillment`. A send
 *     failure records `reviewEmailLastError` via `markReviewEmailFailed` and
 *     leaves `reviewEmailSentAt` unset so the next cron run retries.
 *   - One order failing (send OR bookkeeping) never aborts the batch.
 * Side effects: outbound Resend sends, Mongo bookkeeping, error sink.
 * Caller contract: caller owns auth (cron secret) and passes a connected Db.
 */
import type { Db, Document } from 'mongodb';
import { ORDERS_COLLECTION, type OrderDoc } from '@/lib/orders/types';
import { markReviewEmailFailed, markReviewEmailSent } from '@/lib/orders/mutations';
import { sendEmail } from '@/lib/resend';
import { getMarketConfig } from '@/i18n/market-config';
import { renderReviewRequestEmail, reviewRequestEmailSubject } from '@/lib/emails/review-request';
import { captureError } from '@/lib/error-sink';

export const REVIEW_REQUEST_DELAY_DAYS = 3;
export const REVIEW_REQUEST_MAX_AGE_DAYS = 60;
export const BATCH_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewRequestSummary {
  ok: true;
  candidates: number;
  sent: number;
  failed: number;
  eligibleBefore: string;
  eligibleAfter: string;
}

/** Mongo filter selecting delivered orders whose review-request email is still owed. */
export function buildEligibilityFilter(now: Date): Document {
  const eligibleBefore = new Date(now.getTime() - REVIEW_REQUEST_DELAY_DAYS * DAY_MS);
  const eligibleAfter = new Date(now.getTime() - REVIEW_REQUEST_MAX_AGE_DAYS * DAY_MS);
  return {
    'fulfillment.status': 'delivered',
    'fulfillment.deliveredAt': { $lte: eligibleBefore, $gte: eligibleAfter },
    'fulfillment.reviewEmailSentAt': { $exists: false },
    status: { $nin: ['cancelled', 'refunded'] },
  };
}

export async function runReviewRequestCron(
  db: Db,
  opts: { now?: Date } = {},
): Promise<ReviewRequestSummary> {
  const now = opts.now ?? new Date();
  const eligibleBefore = new Date(now.getTime() - REVIEW_REQUEST_DELAY_DAYS * DAY_MS);
  const eligibleAfter = new Date(now.getTime() - REVIEW_REQUEST_MAX_AGE_DAYS * DAY_MS);

  const eligible = await db
    .collection(ORDERS_COLLECTION)
    .find(buildEligibilityFilter(now))
    .limit(BATCH_LIMIT)
    .toArray();

  let sent = 0;
  let failed = 0;

  for (const doc of eligible) {
    const order = doc as unknown as OrderDoc;
    try {
      const at = new Date();
      await sendEmail({
        from: getMarketConfig(order.market).contact.fromEmail,
        to: [order.email],
        subject: reviewRequestEmailSubject(order),
        html: renderReviewRequestEmail({ order }),
      });
      await markReviewEmailSent(order.orderId, at);
      sent++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      try {
        await markReviewEmailFailed(order.orderId, message, new Date());
      } catch {
        // Why: a failed bookkeeping write must not abort the batch — the
        // next cron run will simply re-attempt this order from scratch.
      }
      captureError(
        err,
        { orderId: order.orderId },
        { tag: 'review_request_email', level: 'warning' },
      );
    }
  }

  return {
    ok: true,
    candidates: eligible.length,
    sent,
    failed,
    eligibleBefore: eligibleBefore.toISOString(),
    eligibleAfter: eligibleAfter.toISOString(),
  };
}
