/**
 * POST /api/admin/orders/[orderId]/shipping — replace the shipping object.
 *
 * Body must satisfy `shippingSchema` (same Zod schema the checkout form
 * uses), so company-branch and alt-shipping fields are preserved end-to-end.
 * Refused on terminal statuses (cancelled / refunded). No customer email is
 * triggered — the operator decides whether to notify.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { editShipping } from '@/lib/orders/mutations';
import { shippingSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'not-found': 404,
  'terminal-status': 409,
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

  const parsed = shippingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'invalid-body',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await editShipping(orderId, parsed.data);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status: HTTP_FOR_REASON[result.reason] ?? 500 },
  );
}
