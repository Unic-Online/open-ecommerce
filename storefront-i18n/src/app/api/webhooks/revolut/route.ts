import { NextResponse, after } from 'next/server'
import { serverEnv } from '@/env'
import {
  retrieveRevolutOrder,
  verifyRevolutWebhookSignature,
  type RevolutOrderState,
  type RevolutWebhookPayload,
} from '@/lib/revolut'
import {
  claimOrderEmail,
  findOrderById,
  findOrderByProviderOrderId,
  markOrderEmailSent,
  recordCapiPurchaseAttempt,
  releaseOrderEmailClaim,
  updateOrderPayment,
} from '@/lib/contacts'
import { sendEmail } from '@/lib/resend'
import { renderOrderEmail } from '@/lib/emails/order-email'
import { customerOrderEmailSubject, renderCustomerOrderEmail } from '@/lib/emails/customer-order-email'
import { issueMagicLinkForEmail } from '@/lib/account-tokens'
import { originFromOrder } from '@/lib/origin'
import { sendServerPurchase, type MetaBrowserTrackingData } from '@/lib/meta-capi'
import { checkoutPaymentExperimentParams, normalizeCheckoutPaymentVariant } from '@/lib/ab-testing'
import type { ShippingData, OrderItem } from '@/lib/validation'
import { markCartCompleted } from '@/plugins/abandoned-cart/server/carts'
import { absoluteUrl } from '@/i18n/market-resolver'
import { DEFAULT_MARKET, getMarketConfig, type MarketKey } from '@/i18n/market-config'
import { captureError } from '@/lib/error-sink'
import { clearUnknownOrderWebhook, recordUnknownOrderWebhook } from '@/lib/webhook-inbox'

export const dynamic = 'force-dynamic'

function statusForState(state: RevolutOrderState): 'pending_payment' | 'paid' | 'cancelled' | 'failed' {
  if (state === 'completed') return 'paid'
  if (state === 'cancelled') return 'cancelled'
  if (state === 'failed') return 'failed'
  return 'pending_payment'
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signingSecret = serverEnv.REVOLUT_WEBHOOK_SIGNING_SECRET

  if (!signingSecret) {
    captureError(new Error('REVOLUT_WEBHOOK_SIGNING_SECRET not configured'), {}, { tag: 'revolut_webhook' })
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  }

  const verify = verifyRevolutWebhookSignature({
    rawBody,
    signatureHeader: request.headers.get('revolut-signature'),
    timestampHeader: request.headers.get('revolut-request-timestamp'),
    signingSecret,
  })

  if (!verify.ok) {
    captureError(new Error(`signature rejected: ${verify.reason}`), {}, { tag: 'revolut_webhook', level: 'warning' })
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: RevolutWebhookPayload
  try {
    payload = JSON.parse(rawBody) as RevolutWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Only act on order events
  if (!payload.order_id) {
    return NextResponse.json({ ok: true, ignored: 'not an order event' })
  }

  // Look up the local order. Prefer matching by Revolut order ID, fall back to
  // merchant_order_ext_ref (our internal short orderId, set as merchant_order_data.reference).
  let localOrder = await findOrderByProviderOrderId(payload.order_id)
  if (!localOrder && payload.merchant_order_ext_ref) {
    localOrder = await findOrderById(payload.merchant_order_ext_ref)
  }

  if (!localOrder) {
    // B1: webhook arrived before our DB write — race between create-order and
    // Revolut's notify pipeline. Returning 200 here would silently lose the
    // order if the customer paid: Revolut treats 2xx as ack and stops retrying.
    // Instead: record the unknown delivery, return 409 for the first N retries
    // so Revolut comes back. Only after we've waited MAX_AGE_MS or absorbed
    // MAX_ATTEMPTS do we accept this as an orphan + surface to the error sink.
    const state = await recordUnknownOrderWebhook(payload.order_id)
    if (!state.shouldGiveUp) {
      return NextResponse.json(
        { error: 'order not found yet, retry', attempts: state.attempts },
        { status: 409 },
      )
    }
    captureError(
      new Error('orphan webhook — paid order has no local doc after retry budget'),
      {
        providerOrderId: payload.order_id,
        merchantOrderExtRef: payload.merchant_order_ext_ref,
        event: payload.event,
        attempts: state.attempts,
        firstSeenAt: state.firstSeenAt.toISOString(),
      },
      { tag: 'revolut_webhook' },
    )
    return NextResponse.json({ ok: true, ignored: 'unknown order (orphan)' })
  }

  // Local doc exists — drop any inbox bookkeeping for this provider order.
  void clearUnknownOrderWebhook(payload.order_id).catch(() => {})

  // Why: even though the webhook payload IS signed (HMAC verified above), the
  // signed body only carries `order_id` + `event` — not the order state. We
  // re-fetch from Revolut to get authoritative state, both as defense in depth
  // and to handle out-of-order webhook delivery (cancelled-then-completed).
  let revolutOrder
  try {
    revolutOrder = await retrieveRevolutOrder(payload.order_id)
  } catch (err) {
    captureError(err, { providerOrderId: payload.order_id, orderId: localOrder.orderId as string }, { tag: 'revolut_webhook' })
    return NextResponse.json({ error: 'retrieve failed' }, { status: 502 })
  }

  const newStatus = statusForState(revolutOrder.state)
  const isPaid = newStatus === 'paid'

  // Flip status atomically. The `expectedPaymentMethod: 'card'` filter is the
  // safety net for the card→ramburs switch — a late `ORDER_COMPLETED` webhook
  // for the orphaned card session must NOT promote a ramburs doc to `paid`.
  //
  // B2: we no longer pass `markEmailSent: true` here. The email idempotency
  // marker is decoupled from the status flip via claimOrderEmail / markOrderEmailSent
  // below, so a Resend failure no longer burns the once-only token.
  const { matched } = await updateOrderPayment(
    localOrder.orderId as string,
    newStatus,
    {
      providerOrderId: revolutOrder.id,
      providerPublicId: revolutOrder.token,
      state: revolutOrder.state,
      lastWebhookEvent: payload.event,
      paidAt: isPaid ? new Date() : undefined,
    },
    { expectedPaymentMethod: 'card' },
  )

  if (!matched) {
    return NextResponse.json({ ok: true, ignored: 'paymentMethod or status changed' })
  }

  if (!isPaid) {
    return NextResponse.json({ ok: true })
  }

  // B2: atomic email-send claim. Distinguishes three outcomes:
  //   - alreadySent: a prior delivery already emailed the customer → 200, no-op
  //   - claimed:    we own the send → proceed to Resend
  //   - !claimed && !alreadySent: another worker is mid-send within the stale
  //                                window → 200 to ack Revolut without
  //                                double-sending; if the in-flight worker
  //                                fails, it releases the claim and the next
  //                                Revolut retry re-claims.
  const claim = await claimOrderEmail(localOrder.orderId as string, { expectedPaymentMethod: 'card' })
  if (claim.alreadySent || !claim.claimed) {
    return NextResponse.json({ ok: true, ignored: claim.alreadySent ? 'already emailed' : 'send in flight' })
  }

  const items = localOrder.items as OrderItem[]
  const shipping = localOrder.shipping as ShippingData
  const total = localOrder.totalPrice as number
  const subtotal = (localOrder.subtotal as number) ?? total
  const discount = (localOrder.discount as number) ?? 0
  const shippingCost = (localOrder.shippingCost as number) ?? 0
  const orderIdStr = localOrder.orderId as string
  const clientIp = (localOrder.clientIp as string | undefined) ?? undefined
  const clientUserAgent = (localOrder.clientUserAgent as string | undefined) ?? undefined
  const tracking = (localOrder.tracking as MetaBrowserTrackingData | undefined) ?? undefined
  const experiments = localOrder.experiments as { checkoutPaymentUi?: string } | undefined
  const checkoutPaymentUi = normalizeCheckoutPaymentVariant(experiments?.checkoutPaymentUi) ?? 'control'
  // Phase 3: read market off the persisted order. Pre-Phase-3 orders lack
  // this field — fall back to DEFAULT_MARKET so the absolute URL keeps
  // resolving to the RO domain (correct, since pre-Phase-3 only RO existed).
  const orderMarket = (localOrder.market as MarketKey | undefined) ?? DEFAULT_MARKET
  const orderMarketConfig = getMarketConfig(orderMarket)

  // Magic-link issuance is best-effort. Failure here MUST NOT block the
  // emails — null result simply omits the CTA from the email body.
  //
  // Webhooks come from Revolut, not the customer, so the request host is
  // useless. Read the host the customer actually used from `order.domain`
  // (persisted at order creation in /api/payments/revolut/create-order).
  const magicLinkUrl = await issueMagicLinkForEmail({
    email: shipping.email,
    locale: orderMarketConfig.locale,
    baseUrl: originFromOrder({
      domain: localOrder.domain as string | undefined,
      market: orderMarket,
    }),
  }).catch(err => {
    captureError(err, { orderId: orderIdStr }, { tag: 'revolut_webhook', level: 'warning' })
    return null
  })

  try {
    await Promise.all([
      sendEmail({
        from: orderMarketConfig.contact.fromEmail,
        to: orderMarketConfig.contact.merchantNotificationEmails,
        subject: `Comandă plătită #${orderIdStr} — ${orderMarketConfig.name}`,
        html: renderOrderEmail({ orderId: orderIdStr, items, shipping, shippingCost, totalPrice: total, paymentMethod: 'card', market: orderMarket }),
        replyTo: shipping.email,
      }),
      sendEmail({
        from: orderMarketConfig.contact.fromEmail,
        to: [shipping.email],
        subject: customerOrderEmailSubject(orderMarketConfig.locale, 'paid', orderIdStr),
        html: renderCustomerOrderEmail({
          orderId: orderIdStr,
          items,
          shipping,
          subtotal,
          discount,
          shippingCost,
          totalPrice: total,
          paymentMethod: 'card',
          market: orderMarket,
          magicLinkUrl,
        }),
      }),
    ])
  } catch (err) {
    // B2: release the claim so the next Revolut retry re-claims and re-sends.
    // Returning non-2xx ensures Revolut DOES retry (default ack is 200).
    await releaseOrderEmailClaim(orderIdStr, err instanceof Error ? err.message : String(err)).catch(() => {})
    captureError(err, { orderId: orderIdStr, email: shipping.email }, { tag: 'revolut_webhook_email' })
    return NextResponse.json({ error: 'email send failed, will retry' }, { status: 502 })
  }

  // Email landed — mark idempotency before firing the post-paid side effects.
  await markOrderEmailSent(orderIdStr)

  // Server-side Meta CAPI Purchase event + cart completion run via `after()`
  // so the function instance stays alive until the outbound fetch to
  // graph.facebook.com / Mongo write completes. The previous
  // `.catch(...)` fire-and-forget got the Promise scheduled but Vercel would
  // freeze the function once NextResponse.json returned — Purchase events
  // would silently disappear before reaching Meta.
  // Idempotent at the provider via eventId = orderId (Meta dedupes within 7
  // days). markCartCompleted is idempotent at the DB layer (`completed`
  // status is locked).
  // Test Events tag captured at create-order time and persisted on the doc.
  // Lets us tag the CAPI Purchase that the webhook fires hours/days later
  // (Apple Pay redirect-and-back, network delays) without depending on any
  // browser session that started the order.
  const persistedTestEventCode = typeof localOrder.testEventCode === 'string'
    ? (localOrder.testEventCode as string)
    : undefined

  after(async () => {
    try {
      const result = await sendServerPurchase({
        orderId: orderIdStr,
        shipping,
        clientIp,
        clientUserAgent,
        totalPrice: total,
        // Order currency persisted at create-order time; fall back to the
        // order market's config currency for legacy docs.
        currency: (localOrder.currency as string | undefined) ?? orderMarketConfig.currency,
        contentIds: items.map((item) => item.id),
        numItems: items.reduce((sum, item) => sum + item.quantity, 0),
        contentName: items.map((item) => item.productName).join(', '),
        shippingCost,
        eventSourceUrl: absoluteUrl(`/confirmare/${orderIdStr}`, orderMarket),
        tracking,
        customData: checkoutPaymentExperimentParams(checkoutPaymentUi),
        marketingConsent: localOrder.marketingConsent === true,
        testEventCode: persistedTestEventCode,
      })
      await recordCapiPurchaseAttempt(orderIdStr, result)
    } catch (err) {
      captureError(err, { orderId: orderIdStr }, { tag: 'meta_capi_purchase' })
    }
  })

  const cartId = localOrder.cartId as string | undefined
  if (cartId) {
    after(async () => {
      try {
        await markCartCompleted({ cartId, orderId: orderIdStr })
      } catch (err) {
        captureError(err, { orderId: orderIdStr, cartId }, { tag: 'mark_cart_completed' })
      }
    })
  }

  return NextResponse.json({ ok: true })
}
