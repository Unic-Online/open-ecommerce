/**
 * Daily Meta CAPI Purchase replay — thin auth wrapper.
 *
 * All replay logic (eligibility filter, batching, per-order send loop,
 * attempt accounting) lives in `@/lib/orders/capi-replay` so it is unit
 * testable. This route only checks the cron Bearer secret and reports the
 * run summary.
 */
import { NextResponse } from 'next/server';
import { serverEnv } from '@/env';
import { getDb } from '@/lib/mongodb';
import { runCapiReplay } from '@/lib/orders/capi-replay';

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
  const summary = await runCapiReplay(db);
  return NextResponse.json(summary);
}

export const POST = GET;
