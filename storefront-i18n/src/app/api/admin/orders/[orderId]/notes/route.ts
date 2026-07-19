/**
 * POST /api/admin/orders/[orderId]/notes — append an internal note.
 *
 * Body: `{ body: string }`. Trimmed; rejects empty/whitespace-only and
 * over-length bodies (>4 KB). 404 if the order does not exist.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { appendNote } from '@/lib/orders/mutations';

export const dynamic = 'force-dynamic';

const MAX_NOTE_BYTES = 4096;

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const body = (payload as { body?: unknown })?.body;
  if (typeof body !== 'string') {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  }
  if (Buffer.byteLength(trimmed, 'utf8') > MAX_NOTE_BYTES) {
    return NextResponse.json({ ok: false, reason: 'too-long' }, { status: 413 });
  }

  const result = await appendNote(orderId, trimmed);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  if (result.reason === 'not-found') {
    return NextResponse.json({ ok: false, reason: 'not-found' }, { status: 404 });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status: result.reason === 'dry-run' ? 503 : 500 },
  );
}
