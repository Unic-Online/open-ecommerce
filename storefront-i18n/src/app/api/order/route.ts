import { NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { generateOrderId } from '@/lib/orders/order-id'
import {
  findActiveOrderByCartId,
  recordCapiPurchaseAttempt,
  upsertContact,
  upsertOrderByCartId,
} from '@/lib/contacts'
import { cancelRevolutOrder } from '@/lib/revolut'
import { sendEmail } from '@/lib/resend'
import { orderRequestSchema } from '@/lib/validation'
import { computeOrderTotal } from '@/lib/pricing'
import { resolveCartForMarket, type ResolvedCartLine } from '@/lib/cart-resolver'
import { renderOrderEmail } from '@/lib/emails/order-email'
import { customerOrderEmailSubject, renderCustomerOrderEmail } from '@/lib/emails/customer-order-email'
import { issueMagicLinkForEmail } from '@/lib/account-tokens'
import { originFromRequest } from '@/lib/origin'
import { resolveMarketFromRequest, absoluteUrl } from '@/i18n/market-resolver'
import { getMarketConfig } from '@/i18n/market-config'
import { extractClientIp, sendServerPurchase } from '@/lib/meta-capi'
import {
  CHECKOUT_PAYMENT_EXPERIMENT_COOKIE,
  checkoutPaymentExperimentParams,
  getCheckoutExperimentAssignment,
  normalizeCheckoutPaymentVariant,
} from '@/lib/ab-testing'
import { CART_COOKIE_NAME } from '@/plugins/abandoned-cart/shared/types'
import { markCartCompleted } from '@/plugins/abandoned-cart/server/carts'
import { redeemCoupon } from '@/plugins/abandoned-cart/server/coupons'
import { captureError } from '@/lib/error-sink'

// Romanian copy for resolver failures. Server-side validation only — these
// strings should never reach a normal user, only somebody tampering with
// the cart payload or hitting the API directly.
function resolverErrorMessage(reason: 'unknown_product' | 'unavailable_in_market' | 'currency_mismatch' | 'out_of_stock_blocking'): string {
  switch (reason) {
    case 'unknown_product':
      return 'Unul dintre produse nu există în catalog. Reîncarcă pagina și încearcă din nou.'
    case 'unavailable_in_market':
      return 'Unul dintre produse nu este disponibil pentru livrare în zona ta.'
    case 'currency_mismatch':
      return 'Coșul conține produse cu monede diferite. Plasează comenzi separate pentru fiecare monedă.'
    case 'out_of_stock_blocking':
      return 'Unul dintre produse nu mai este în stoc.'
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = orderRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Date lipsă', issues: result.error.issues },
        { status: 400 }
      )
    }

    const { shipping, items, paymentMethod, marketingConsent, couponCode, tracking, experiments, testEventCode } = result.data

    // Card payments must go through /api/payments/revolut/create-order so we
    // never silently accept a card order without initiating payment.
    if (paymentMethod === 'card') {
      return NextResponse.json(
        { error: 'Pentru plata cu cardul folosește /api/payments/revolut/create-order.' },
        { status: 400 }
      )
    }

    // Derive commercial market from the request host. RO defaults if the host
    // is unknown (preview deployments). FR is gated below — its checkout is
    // disabled until Phase 7 prerequisites are met.
    const market = resolveMarketFromRequest(request)
    const marketConfig = getMarketConfig(market)
    const requestHost = request.headers.get('host') ?? marketConfig.domain

    // Hard gate: refuse orders from any market whose checkout is not enabled.
    if (!marketConfig.checkout.enabled) {
      return NextResponse.json(
        { error: 'Comenzile nu sunt încă disponibile pentru această piață.' },
        { status: 403 },
      )
    }

    // Per-market payment-method gate. FR is card-only (no cash-on-delivery
    // cross-border); a stray ramburs payload from FR must not slip through
    // to saveOrder() just because the market is enabled.
    if (!marketConfig.checkout.paymentMethods.includes('ramburs')) {
      return NextResponse.json(
        { error: 'Această metodă de plată nu este disponibilă pentru această piață.' },
        { status: 400 },
      )
    }

    // Server-trust: resolve client cart against the catalog so the saved/charged
    // unitPrice never comes from the wire. A tampered `unitPrice: 1` is silently
    // overridden with the catalog price for that product+market.
    const resolved = resolveCartForMarket(items, market)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolverErrorMessage(resolved.reason), reason: resolved.reason, productId: resolved.productId },
        { status: 400 },
      )
    }
    const resolvedItems: ResolvedCartLine[] = resolved.lines

    const fallbackOrderId = generateOrderId()

    const clientIp = extractClientIp(request.headers)
    const clientUserAgent = request.headers.get('user-agent')?.slice(0, 2048) ?? undefined
    // Capture the cartId so the abandoned-cart plugin can mark this cart
    // completed and stop sending recovery emails. Optional — pre-plugin
    // visitors won't have one.
    const cookieStore = await cookies()
    const cartId = cookieStore.get(CART_COOKIE_NAME)?.value
    const checkoutPaymentUi =
      experiments?.checkoutPaymentUi ??
      normalizeCheckoutPaymentVariant(cookieStore.get(CHECKOUT_PAYMENT_EXPERIMENT_COOKIE)?.value) ??
      'control'
    const checkoutExperiments = getCheckoutExperimentAssignment(checkoutPaymentUi)

    // Detect a card-prepared phantom doc on this cart + email so we can keep
    // the already-redeemed coupon and cancel the dangling Revolut session.
    // The email match guards against a shared-browser cartId belonging to a
    // different customer (see findActiveOrderByCartId docstring).
    const existingActive = cartId
      ? await findActiveOrderByCartId(cartId, shipping.email)
      : null
    const existingCouponPercent =
      typeof existingActive?.couponDiscountPercent === 'number'
        ? (existingActive.couponDiscountPercent as number)
        : undefined

    // Atomic coupon redemption BEFORE pricing, so a failed redemption never
    // applies the bonus discount to the saved order. Coupon is bound to the
    // shipping email and single-use; concurrent attempts lose the race.
    let appliedCouponPercent: number | undefined = existingCouponPercent
    if (couponCode && existingCouponPercent === undefined) {
      const redeemed = await redeemCoupon({
        code: couponCode,
        email: shipping.email,
        orderId: fallbackOrderId,
      })
      if (redeemed) {
        appliedCouponPercent = redeemed.discountPercent
      }
      // Silent fail on invalid coupon — order still proceeds at the default
      // 20% rate. We don't want a typo to block checkout.
    }

    // Persist the code that was ACTUALLY redeemed. On reuse the percent comes
    // from the existing doc, so the doc's own couponCode must survive — the
    // request body may omit it (`$set: { couponCode: undefined }` would be
    // serialized as null by the driver, wiping it) or carry a different,
    // never-redeemed code that must not be recorded as redeemed.
    const persistedCouponCode =
      existingCouponPercent !== undefined
        ? (typeof existingActive?.couponCode === 'string' ? existingActive.couponCode : undefined)
        : couponCode

    const { subtotal, discount, shippingCost, total } = computeOrderTotal(resolvedItems, {
      couponDiscountPercent: appliedCouponPercent,
      shipping: marketConfig.shipping,
    })

    // Idempotent persist: if an order on this cart is already in flight (a
    // pending_payment card prep the customer abandoned), update it in place
    // and reuse its orderId instead of minting a duplicate.
    const upserted = await upsertOrderByCartId({
      cartId,
      fallbackOrderId,
      email: shipping.email,
      orderData: {
        shipping,
        items: resolvedItems,
        subtotal,
        discount,
        shippingCost,
        totalPrice: total,
        paymentMethod: 'ramburs',
        status: 'received',
        clientIp,
        clientUserAgent,
        marketingConsent,
        experiments: checkoutExperiments,
        market,
        locale: marketConfig.locale,
        currency: marketConfig.currency,
        domain: requestHost,
        ...(tracking ? { tracking } : {}),
        ...(cartId ? { cartId } : {}),
        // Persist the Test Events tag so the cron replay can tag late retries.
        // Without this, a retried Purchase silently lands in the prod stream
        // even though the original session was a Test Events run.
        ...(testEventCode ? { testEventCode } : {}),
        ...(appliedCouponPercent !== undefined
          ? {
              couponDiscountPercent: appliedCouponPercent,
              ...(persistedCouponCode ? { couponCode: persistedCouponCode } : {}),
            }
          : {}),
      },
    })
    const orderId = upserted.orderId

    // Cancel any dangling Revolut session from a previous card prep on this
    // cart so it can never flip to paid behind our back. The webhook guard
    // (`expectedPaymentMethod: 'card'`) is the actual safety net; this is
    // best-effort cleanup so the provider's books match ours.
    const previousProviderOrderId =
      upserted.reused
        ? ((upserted.previous?.payment as { providerOrderId?: string } | undefined)?.providerOrderId)
        : undefined
    if (previousProviderOrderId) {
      cancelRevolutOrder(previousProviderOrderId).catch(err =>
        captureError(err, { orderId, previousProviderOrderId }, { tag: 'revolut_cancel_previous' }),
      )
    }

    if (cartId) {
      after(async () => {
        try {
          await markCartCompleted({ cartId, orderId })
        } catch (err) {
          captureError(err, { orderId, cartId }, { tag: 'mark_cart_completed' })
        }
      })
    }

    const emailHtml = renderOrderEmail({ orderId, items: resolvedItems, shipping, shippingCost, totalPrice: total, paymentMethod: 'ramburs', market })

    // Send merchant email via Resend. Merchant copy is always Romanian
    // because the merchant is the RO SRL — no localization needed here.
    await sendEmail({
      from: marketConfig.contact.fromEmail,
      to: marketConfig.contact.merchantNotificationEmails,
      subject: `Comandă nouă #${orderId} — ${marketConfig.name}`,
      html: emailHtml,
      replyTo: shipping.email,
    })

    // Customer confirmation — non-blocking; ramburs is "received" not "paid",
    // and the customer email reflects that. Sender is market-aware so each
    // market uses its own configured `fromEmail` / brand name.
    // Magic-link issuance is best-effort: a missing HMAC secret returns null
    // and the email simply omits the CTA — never blocks order placement.
    // Why: use the request origin (the host the customer is actually on)
    // so a staging tester gets a staging link and a customer on one market's
    // host doesn't get pulled into another market's domain.
    const magicLinkUrl = await issueMagicLinkForEmail({
      email: shipping.email,
      locale: marketConfig.locale,
      baseUrl: originFromRequest(request),
    }).catch(err => {
      console.error('Failed to issue order-email magic link:', err)
      return null
    })

    // Customer confirmation email, Resend audience sync, and the server-side
    // Meta CAPI Purchase all run via `after()` — they belong to the request's
    // logical lifetime but must NOT delay the response. Before this, the
    // `.catch(...)` fire-and-forget pattern was unreliable on Vercel: the
    // function instance can be frozen the moment NextResponse.json returns,
    // leaving the unawaited fetches to graph.facebook.com / Resend / Mongo
    // cancelled in flight. `after()` keeps the instance alive until each
    // callback resolves.
    after(async () => {
      try {
        await sendEmail({
          from: marketConfig.contact.fromEmail,
          to: [shipping.email],
          subject: customerOrderEmailSubject(marketConfig.locale, 'placed', orderId),
          html: renderCustomerOrderEmail({
            orderId,
            items: resolvedItems,
            shipping,
            subtotal,
            discount,
            shippingCost,
            totalPrice: total,
            paymentMethod: 'ramburs',
            market,
            magicLinkUrl,
          }),
        })
      } catch (err) {
        captureError(err, { orderId, email: shipping.email }, { tag: 'customer_email' })
      }
    })

    after(async () => {
      try {
        await upsertContact(shipping.email, {
          firstName: shipping.firstName,
          lastName: shipping.lastName,
          phone: shipping.phone,
          county: shipping.county,
          city: shipping.city,
          address: shipping.address,
          country: shipping.country,
          postalCode: shipping.postalCode,
          source: 'order',
        })
      } catch (err) {
        captureError(err, { orderId, email: shipping.email }, { tag: 'upsert_contact' })
      }
    })

    after(async () => {
      try {
        const result = await sendServerPurchase({
          orderId,
          shipping,
          clientIp,
          clientUserAgent,
          totalPrice: total,
          currency: marketConfig.currency,
          contentIds: resolvedItems.map((item) => item.id),
          numItems: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
          contentName: resolvedItems.map((item) => item.productName).join(', '),
          shippingCost,
          eventSourceUrl: absoluteUrl(`/confirmare/${orderId}`, market),
          tracking,
          customData: checkoutPaymentExperimentParams(checkoutPaymentUi),
          marketingConsent,
          testEventCode,
        })
        await recordCapiPurchaseAttempt(orderId, result)
      } catch (err) {
        captureError(err, { orderId }, { tag: 'meta_capi_purchase_ramburs' })
      }
    })

    return NextResponse.json({ orderId, success: true, shippingCost, totalPrice: total })
  } catch (error: unknown) {
    console.error('Order API error:', error)
    return NextResponse.json(
      { error: 'Eroare internă. Încearcă din nou.' },
      { status: 500 }
    )
  }
}
