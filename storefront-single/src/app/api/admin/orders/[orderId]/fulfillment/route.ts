/**
 * POST /api/admin/orders/[orderId]/fulfillment — patch fulfillment fields
 * (status, carrier, trackingNumber). When the resulting state is `shipped`
 * with a non-empty tracking number AND the shipment email has not yet
 * succeeded, this route additionally sends the shipment email through
 * Resend and records the outcome via `markShipmentEmailSent` /
 * `markShipmentEmailFailed`.
 *
 * Idempotency:
 *   - `setFulfillment` returns `needsShipmentEmail: true` only when
 *     `shipmentEmailSentAt` is currently absent. Once Resend reports 200
 *     and `markShipmentEmailSent` records that timestamp, subsequent edits
 *     to tracking number / carrier never re-fire the email.
 *   - On send failure, `markShipmentEmailFailed` records the error string
 *     and leaves `shipmentEmailSentAt` unset. The next fulfillment write
 *     retries (operator-driven retry — no automatic retry loop).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/plugins/abandoned-cart/server/admin-auth';
import {
  markShipmentEmailFailed,
  markShipmentEmailSent,
  setFulfillment,
} from '@/lib/orders/mutations';
import { sendEmail } from '@/lib/resend';
import { issueMagicLinkForEmail } from '@/lib/account-tokens';
import { originFromOrder } from '@/lib/origin';
import {
  renderShipmentEmail,
  shipmentEmailSubject,
} from '@/lib/emails/shipment-email';
import { getMarketConfig } from '@/lib/market';
import {
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
} from '@/lib/orders/status-machine';
import type { Fulfillment } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

const HTTP_FOR_REASON: Record<string, number> = {
  'not-found': 404,
  'terminal-status': 409,
  'dry-run': 503,
};

interface FulfillmentBody {
  status?: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
}

function parseBody(body: unknown): FulfillmentBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const out: FulfillmentBody = {};
  if (b.status !== undefined) {
    if (
      typeof b.status !== 'string' ||
      !(FULFILLMENT_STATUSES as ReadonlyArray<string>).includes(b.status)
    ) {
      return null;
    }
    out.status = b.status as FulfillmentStatus;
  }
  if (b.carrier !== undefined) {
    if (typeof b.carrier !== 'string') return null;
    out.carrier = b.carrier.trim().slice(0, 80);
  }
  if (b.trackingNumber !== undefined) {
    if (typeof b.trackingNumber !== 'string') return null;
    out.trackingNumber = b.trackingNumber.trim().slice(0, 120);
  }
  return out;
}

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
  const body = parseBody(raw);
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const result = await setFulfillment(orderId, body as Partial<Fulfillment>);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: HTTP_FOR_REASON[result.reason] ?? 500 },
    );
  }

  if (!result.needsShipmentEmail) {
    return NextResponse.json({ ok: true, shipmentEmailSent: false });
  }

  const order = result.order;
  const marketConfig = getMarketConfig();
  const at = new Date();
  // Best-effort magic link. If issuance throws (e.g. Mongo blip), the
  // shipment notification still goes out, just without the account CTA.
  //
  // Admin actions are out-of-band relative to the customer, so the request
  // host is irrelevant. Read the customer's storefront host from the order
  // doc so a staging-placed order gets a staging link.
  const magicLinkUrl = await issueMagicLinkForEmail({
    email: order.email,
    baseUrl: originFromOrder({ domain: order.domain }),
  }).catch(err => {
    console.error('[shipment-email] failed to issue magic link:', err);
    return null;
  });
  try {
    await sendEmail({
      from: marketConfig.contact.fromEmail,
      to: [order.email],
      subject: shipmentEmailSubject(order),
      html: renderShipmentEmail({ order, magicLinkUrl }),
    });
    await markShipmentEmailSent(orderId, at);
    return NextResponse.json({ ok: true, shipmentEmailSent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markShipmentEmailFailed(orderId, message, at);
    return NextResponse.json({
      ok: true,
      shipmentEmailSent: false,
      sendError: message,
    });
  }
}
