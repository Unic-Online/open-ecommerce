import { NextResponse } from 'next/server';
import {
  forceAdvanceCart,
  type ForceAdvanceResult,
} from '@/plugins/abandoned-cart/server/recovery-cron';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ cartId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'unknown-cart': 404,
  completed: 409,
  recovered: 409,
  'no-email': 422,
  empty: 422,
  'max-step': 409,
  'race-lost': 409,
  'dry-run': 503,
};

/**
 * Admin one-shot: bump a single cart's recoveryStep by 1 right now,
 * skipping the cron's time gates. Useful for manual QA.
 *
 * Auth-gated by the same admin cookie session as /admin. Returns the
 * structured ForceAdvanceResult; HTTP status mirrors the failure reason
 * so curl-based debugging is informative.
 */
export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const { cartId } = await context.params;
  if (!cartId || typeof cartId !== 'string') {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const result: ForceAdvanceResult = await forceAdvanceCart(cartId);
  if (result.ok) {
    return NextResponse.json(result);
  }
  const status = (result.reason && HTTP_FOR_REASON[result.reason]) || 500;
  return NextResponse.json(result, { status });
}
