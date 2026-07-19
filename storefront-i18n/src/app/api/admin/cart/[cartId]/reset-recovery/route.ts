import { NextResponse } from 'next/server';
import {
  resetCartRecovery,
  type ResetRecoveryResult,
} from '@/plugins/abandoned-cart/server/recovery-cron';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ cartId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'unknown-cart': 404,
  completed: 409,
  'dry-run': 503,
};

/**
 * Admin one-shot: clear a cart's recovery state (recoveryStep → 0,
 * recoveryEmails[] → [], couponCode/abandonedAt cleared) so the funnel can
 * run again. Auth-gated by the same admin cookie session as /admin.
 */
export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const { cartId } = await context.params;
  if (!cartId || typeof cartId !== 'string') {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const result: ResetRecoveryResult = await resetCartRecovery(cartId);
  if (result.ok) {
    return NextResponse.json(result);
  }
  const status = (result.reason && HTTP_FOR_REASON[result.reason]) || 500;
  return NextResponse.json(result, { status });
}
