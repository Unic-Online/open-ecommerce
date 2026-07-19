import { NextResponse } from 'next/server';
import { serverEnv } from '@/env';
import { runRecoveryCron } from '@/plugins/abandoned-cart/server/recovery-cron';

export const dynamic = 'force-dynamic';
// Vercel Cron may exceed the default execution limit on large batches.
// Hobby tier caps at 60s; Pro at 300s.
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = serverEnv.CART_RECOVERY_CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get('authorization');
  if (!auth) return false;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Manual triggers
  // can send the same header.
  if (auth === `Bearer ${expected}`) return true;
  return false;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const result = await runRecoveryCron();
  return NextResponse.json(result);
}

// Allow POST too — handy for manual curl-based triggers in QA.
export const POST = GET;
