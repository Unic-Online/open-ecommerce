/**
 * Daily review-request cron — thin auth wrapper.
 *
 * All eligibility + send logic lives in `@/lib/orders/review-request-cron` so
 * it is unit testable. This route only checks the cron Bearer secret and
 * reports the run summary.
 */
import { NextResponse } from 'next/server';
import { serverEnv } from '@/env';
import { getDb } from '@/lib/mongodb';
import { runReviewRequestCron } from '@/lib/orders/review-request-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = serverEnv.CART_RECOVERY_CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const db = await getDb();
  const summary = await runReviewRequestCron(db);
  return NextResponse.json(summary);
}

export const POST = GET;
