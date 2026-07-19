import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { isProductionRuntime, validateProdEnv } from '@/lib/env';
import { captureError } from '@/lib/error-sink';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  const checks: Record<string, 'ok' | 'fail' | 'skipped'> = {};
  const errors: Record<string, string> = {};

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    checks.mongo = 'ok';
  } catch (err) {
    checks.mongo = 'fail';
    errors.mongo = err instanceof Error ? err.message : String(err);
    captureError(err, { route: '/api/health', check: 'mongo' }, { tag: 'health_check' });
  }

  if (isProductionRuntime()) {
    const env = validateProdEnv();
    checks.env = env.ok ? 'ok' : 'fail';
    if (!env.ok) errors.env = `missing: ${env.missing.join(', ')}`;
  } else {
    checks.env = 'skipped';
  }

  const ok = !Object.values(checks).includes('fail');
  return NextResponse.json(
    {
      ok,
      checks,
      ...(Object.keys(errors).length ? { errors } : {}),
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: ok ? 200 : 503 },
  );
}
