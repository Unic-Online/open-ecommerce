/**
 * POST /api/admin/orders/[orderId]/resend-email — re-send the customer
 * order confirmation email. Always sends; does NOT touch `emailSentAt`
 * (still owned by the original send path so the once-only contract
 * remains correct for future webhook deliveries).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { getOrder } from '@/lib/orders/queries';
import { getDb } from '@/lib/mongodb';
import { captureError } from '@/lib/error-sink';
import { sendEmail } from '@/lib/resend';
import { customerOrderEmailSubject, renderCustomerOrderEmail } from '@/lib/emails/customer-order-email';
import { getMarketConfig } from '@/lib/market';
import { ORDERS_COLLECTION, type OrderDoc } from '@/lib/orders/types';

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

  const marketConfig = getMarketConfig();
  const subject = customerOrderEmailSubject('resend', order.orderId);

  try {
    await sendEmail({
      from: marketConfig.contact.fromEmail,
      to: [order.email],
      subject,
      html: renderCustomerOrderEmail({
        orderId: order.orderId,
        items: order.items,
        shipping: order.shipping,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingCost: order.shippingCost,
        totalPrice: order.totalPrice,
        paymentMethod: order.paymentMethod,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, reason: 'send-failed', sendError: message },
      { status: 502 },
    );
  }

  // The email already went out — a failed audit write must NOT crash the
  // handler (operator would see a timeout and no confirmation despite the
  // customer being emailed). Best-effort: log to the error sink and still 200.
  const at = new Date();
  try {
    const db = await getDb();
    await db.collection<OrderDoc>(ORDERS_COLLECTION).updateOne(
      { orderId },
      {
        $push: { auditLog: { kind: 'email_resent', subject: 'order', at } },
        $set: { updatedAt: at },
      },
    );
  } catch (err) {
    captureError(err, { route: '/api/admin/orders/[orderId]/resend-email', orderId }, { tag: 'audit_log_write' });
  }

  return NextResponse.json({ ok: true });
}
