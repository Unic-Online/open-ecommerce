/**
 * POST /api/admin/orders/[orderId]/status — operator-driven status transition.
 *
 * Body: `{ to: OrderStatus }`. Legality is enforced atomically inside the
 * Mongo filter via `transitionStatus` (no read-then-write race). Maps
 * `illegal-transition` → 409, `not-found` → 404, `dry-run` → 503.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { transitionStatus } from '@/lib/orders/mutations';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/orders/status-machine';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'illegal-transition': 409,
  'not-found': 404,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const to = (body as { to?: unknown })?.to;
  if (typeof to !== 'string' || !(ORDER_STATUSES as ReadonlyArray<string>).includes(to)) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const result = await transitionStatus(orderId, to as OrderStatus);
  if (result.ok) {
    return NextResponse.json({ ok: true, from: result.from, to });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status: HTTP_FOR_REASON[result.reason] ?? 500 },
  );
}
