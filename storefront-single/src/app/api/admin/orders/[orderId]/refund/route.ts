/**
 * POST /api/admin/orders/[orderId]/refund — record a manual refund and
 * atomically transition status to `refunded`.
 *
 * Body: `{ amount: number, reason?: string, reference?: string }`. Amount
 * is in major units (RON / EUR), validated > 0 and ≤ totalPrice in
 * `recordRefund`. Refused if a refund is already recorded or if the
 * current status isn't in `ALLOWED_FROM.refunded` (today: received / paid).
 *
 * v1 does NOT call Revolut's refund API — operator triggers the actual
 * refund in Revolut's dashboard. The `reference` field is for the Revolut
 * refund ID once issued.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { recordRefund } from '@/lib/orders/mutations';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'not-found': 404,
  'already-refunded': 409,
  'illegal-transition': 409,
  'invalid-amount': 400,
  'dry-run': 503,
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }
  const body = raw as { amount?: unknown; reason?: unknown; reference?: unknown };
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount)) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : undefined;
  const reference =
    typeof body.reference === 'string'
      ? body.reference.trim().slice(0, 200)
      : undefined;

  const result = await recordRefund(orderId, {
    amount: body.amount,
    reason: reason || undefined,
    reference: reference || undefined,
  });
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status: HTTP_FOR_REASON[result.reason] ?? 500 },
  );
}
