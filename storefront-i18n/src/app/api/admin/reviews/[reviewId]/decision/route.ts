/**
 * POST /api/admin/reviews/[reviewId]/decision — operator moderation decision.
 *
 * Body: `{ action: 'approve' | 'decline' }`. Legality (only a `pending`
 * review can be decided) is enforced atomically inside `decideReview`'s
 * Mongo filter — no read-then-write race between two admins/tabs.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { decideReview } from '@/lib/reviews-store';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ reviewId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'not-found': 404,
  'already-decided': 409,
  'dry-run': 503,
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const { reviewId } = await context.params;
  if (!reviewId) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const action = (body as { action?: unknown })?.action;
  if (action !== 'approve' && action !== 'decline') {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const result = await decideReview(reviewId, action === 'approve' ? 'approved' : 'declined');
  if (result.ok) {
    return NextResponse.json({ ok: true, status: result.review.status });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status: HTTP_FOR_REASON[result.reason] ?? 500 },
  );
}
