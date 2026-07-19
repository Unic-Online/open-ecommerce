/**
 * POST /api/admin/orders/[orderId]/resend-shipment-email — re-send the
 * shipment email on operator demand. Always sends; does NOT touch
 * `shipmentEmailSentAt` (so the idempotency marker for the auto-send path
 * stays meaningful). Refused if the order is not currently in a `shipped`
 * fulfillment state.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { getOrder } from '@/lib/orders/queries';
import { sendEmail } from '@/lib/resend';
import { getDb } from '@/lib/mongodb';
import { captureError } from '@/lib/error-sink';
import {
  renderShipmentEmail,
  shipmentEmailSubject,
} from '@/lib/emails/shipment-email';
import { getMarketConfig } from '@/lib/market';
import { ORDERS_COLLECTION } from '@/lib/orders/types';
import type { OrderDoc } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  if (isAbandonedCartDryRun()) {
    return NextResponse.json({ ok: false, reason: 'dry-run' }, { status: 503 });
  }

  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, reason: 'not-found' }, { status: 404 });
  }
  if (order.fulfillment?.status !== 'shipped') {
    return NextResponse.json(
      { ok: false, reason: 'not-shipped' },
      { status: 409 },
    );
  }

  const marketConfig = getMarketConfig();
  try {
    await sendEmail({
      from: marketConfig.contact.fromEmail,
      to: [order.email],
      subject: shipmentEmailSubject(order),
      html: renderShipmentEmail({ order }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, reason: 'send-failed', sendError: message },
      { status: 502 },
    );
  }

  // Audit only — do NOT touch shipmentEmailSentAt; the idempotency marker
  // belongs to the auto-send path. The email already sent, so a failed audit
  // write is best-effort (log + still 200) rather than crashing the handler.
  const at = new Date();
  try {
    const db = await getDb();
    await db.collection<OrderDoc>(ORDERS_COLLECTION).updateOne(
      { orderId },
      {
        $push: {
          auditLog: { kind: 'email_resent', subject: 'shipment', at },
        },
        $set: { updatedAt: at },
      },
    );
  } catch (err) {
    captureError(err, { route: '/api/admin/orders/[orderId]/resend-shipment-email', orderId }, { tag: 'audit_log_write' });
  }

  return NextResponse.json({ ok: true });
}
