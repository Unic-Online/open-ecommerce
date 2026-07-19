import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateOrderId } from '@/lib/orders/order-id'
import { orderRequestSchema } from '@/lib/validation'
import { computeOrderTotal, toMinorUnits } from '@/lib/pricing'
import { resolveCartForMarket, type ResolvedCartLine } from '@/lib/cart-resolver'
import { cancelRevolutOrder, createRevolutOrder } from '@/lib/revolut'
import {
  findActiveOrderByCartId,
  updateOrderPayment,
  upsertContact,
  upsertOrderByCartId,
} from '@/lib/contacts'
import { extractClientIp } from '@/lib/meta-capi'
import { absoluteUrl, getMarketConfig } from '@/lib/market'
import {
  CHECKOUT_PAYMENT_EXPERIMENT_COOKIE,
  getCheckoutExperimentAssignment,
  normalizeCheckoutPaymentVariant,
} from '@/lib/ab-testing'
import { CART_COOKIE_NAME } from '@/plugins/abandoned-cart/shared/types'
import { redeemCoupon } from '@/plugins/abandoned-cart/server/coupons'
import { captureError } from '@/lib/error-sink'

function resolverErrorMessage(reason: 'unknown_product' | 'unavailable_in_market' | 'currency_mismatch' | 'out_of_stock_blocking'): string {
  switch (reason) {
    case 'unknown_product':
      return 'One of the products is no longer in the catalogue. Reload the page and try again.'
    case 'unavailable_in_market':
      return 'One of the products is not available for delivery in your area.'
    case 'currency_mismatch':
      return 'Your basket contains products in different currencies. Please place a separate order for each currency.'
    case 'out_of_stock_blocking':
      return 'One of the products is no longer in stock.'
  }
}

// B3: collect every Revolut session id ever associated with this order so we
// can cancel ALL of them on the next prepare, not only the most recent.
// Closes the tab-race window where two parallel POSTs each create a Revolut
// session and only the last `providerOrderId` is persisted.
function collectPreviousProviderOrderIds(previous: Record<string, unknown> | undefined): string[] {
  if (!previous) return []
  const payment = previous.payment as { providerOrderId?: string; previousProviderOrderIds?: unknown } | undefined
  const ids = new Set<string>()
  if (payment?.providerOrderId) ids.add(payment.providerOrderId)
  if (Array.isArray(payment?.previousProviderOrderIds)) {
    for (const id of payment.previousProviderOrderIds) {
      if (typeof id === 'string' && id) ids.add(id)
    }
  }
  return Array.from(ids)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = orderRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Missing data', issues: result.error.issues },
        { status: 400 }
      )
    }

    const { shipping, items, marketingConsent, couponCode, tracking, experiments, testEventCode } = result.data

    // Currency, shipping, and checkout gating all derive from market config —
    // the Revolut payment path must be refused when checkout is not enabled,
    // even if the client somehow reaches this endpoint.
    const marketConfig = getMarketConfig()
    const requestHost = request.headers.get('host') ?? marketConfig.domain

    if (!marketConfig.checkout.enabled) {
      return NextResponse.json(
        { error: 'Card payments are not available yet.' },
        { status: 403 },
      )
    }

    // Server-trust: resolve client items against the catalog before pricing.
    // A tampered `unitPrice: 1` yields the catalog line price.
    const resolved = resolveCartForMarket(items)
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolverErrorMessage(resolved.reason), reason: resolved.reason, productId: resolved.productId },
        { status: 400 },
      )
    }
    const resolvedItems: ResolvedCartLine[] = resolved.lines

    const fallbackOrderId = generateOrderId()

    // Currency is market-derived. The Revolut merchant account currently
    // only supports RON; the FR market is gated above, so this can't deliver
    // a non-RON value to Revolut today (Phase 7 unlocks multi-currency once
    // the merchant account is configured).
    const currency = marketConfig.currency
    const clientIp = extractClientIp(request.headers)
    const clientUserAgent = request.headers.get('user-agent')?.slice(0, 2048) ?? undefined
    const cookieStore = await cookies()
    const cartId = cookieStore.get(CART_COOKIE_NAME)?.value
    const checkoutPaymentUi =
      experiments?.checkoutPaymentUi ??
      normalizeCheckoutPaymentVariant(cookieStore.get(CHECKOUT_PAYMENT_EXPERIMENT_COOKIE)?.value) ??
      'control'
    const checkoutExperiments = getCheckoutExperimentAssignment(checkoutPaymentUi)

    // Look up an existing non-terminal order on this cart so we can:
    //   - skip a second coupon redemption (single-use; would no-op anyway,
    //     but emits a misleading "code already used" log line);
    //   - cancel the previous Revolut session if the customer is re-preparing
    //     card payment after a shipping/cart edit.
    const existingActive = cartId
      ? await findActiveOrderByCartId(cartId, shipping.email)
      : null
    const existingCouponPercent =
      typeof existingActive?.couponDiscountPercent === 'number'
        ? (existingActive.couponDiscountPercent as number)
        : undefined

    let appliedCouponPercent: number | undefined = existingCouponPercent
    if (couponCode && existingCouponPercent === undefined) {
      const redeemed = await redeemCoupon({
        code: couponCode,
        email: shipping.email,
        orderId: fallbackOrderId,
      })
      if (redeemed) appliedCouponPercent = redeemed.discountPercent
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

    // Server-trust: totals are recomputed from `resolvedItems` (catalog prices),
    // not from `result.data.totalPrice` and not from the client's `items.unitPrice`.
    // Never wire `totalPrice` into the Revolut payload.
    const { subtotal, discount, shippingCost, total } = computeOrderTotal(resolvedItems, {
      couponDiscountPercent: appliedCouponPercent,
      shipping: marketConfig.shipping,
    })

    // Idempotent persist: if an order on this cart is still in flight
    // (`pending_payment` from a card prep, or `received` from an earlier
    // cash-on-delivery the customer is re-doing as card), update it in place. Otherwise
    // insert a new doc. The returned orderId is what the Revolut order's
    // `merchantOrderRef` and our `/confirmare/[orderId]` use.
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
        paymentMethod: 'card',
        status: 'pending_payment',
        clientIp,
        clientUserAgent,
        marketingConsent,
        experiments: checkoutExperiments,
        ...(tracking ? { tracking } : {}),
        ...(cartId ? { cartId } : {}),
        ...(appliedCouponPercent !== undefined
          ? {
              couponDiscountPercent: appliedCouponPercent,
              ...(persistedCouponCode ? { couponCode: persistedCouponCode } : {}),
            }
          : {}),
        market: marketConfig.key,
        currency,
        domain: requestHost,
        // Persisted so the webhook (which runs out-of-band of the customer's
        // browser session) can tag its Purchase CAPI with the same test code.
        ...(testEventCode ? { testEventCode } : {}),
        payment: { provider: 'revolut', currency, amountMinor: toMinorUnits(total, currency), initiatedAt: new Date() },
      },
    })
    const orderId = upserted.orderId

    // B3: cancel EVERY previously-created Revolut session for this order, not
    // just the most recent one. Two concurrent tabs / a retry storm can each
    // create a session and persist them in sequence; without this, the older
    // sessions remain live at the provider and could race the webhook.
    const previousProviderOrderIds = upserted.reused
      ? collectPreviousProviderOrderIds(upserted.previous)
      : []
    for (const previousId of previousProviderOrderIds) {
      cancelRevolutOrder(previousId).catch(err =>
        captureError(err, { orderId, previousProviderOrderId: previousId }, { tag: 'revolut_cancel_previous' }),
      )
    }

    upsertContact(shipping.email, {
      firstName: shipping.firstName,
      lastName: shipping.lastName,
      phone: shipping.phone,
      county: shipping.county,
      city: shipping.city,
      address: shipping.address,
      country: shipping.country,
      postalCode: shipping.postalCode,
      source: 'order',
    }).catch(err => captureError(err, { orderId, email: shipping.email }, { tag: 'upsert_contact' }))

    let revolutOrder
    try {
      revolutOrder = await createRevolutOrder({
        amountMinor: toMinorUnits(total, currency),
        currency,
        description: `${marketConfig.name} — order #${orderId}`,
        merchantOrderRef: orderId,
        redirectUrl: absoluteUrl(`/order-confirmation/${orderId}`),
        customer: {
          email: shipping.email,
          full_name: `${shipping.firstName} ${shipping.lastName}`.trim(),
          phone: shipping.phone,
        },
        metadata: { internal_order_id: orderId },
        // B3: idempotent at the provider. A network retry with the same
        // (orderId, total) returns the same Revolut order id instead of
        // creating a duplicate session.
        idempotencyKey: `order:${orderId}:${toMinorUnits(total, currency)}`,
      })
    } catch (err) {
      captureError(err, { orderId, email: shipping.email }, { tag: 'revolut_create_order' })
      await updateOrderPayment(orderId, 'failed', { state: 'failed', lastWebhookEvent: 'CREATE_ORDER_FAILED' }).catch(secondaryErr =>
        captureError(secondaryErr, { orderId, primary: 'CREATE_ORDER_FAILED' }, { tag: 'update_order_payment' }),
      )
      return NextResponse.json({ error: 'Could not start the card payment. Try cash on delivery or come back later.' }, { status: 502 })
    }

    if (!revolutOrder.id || !revolutOrder.token) {
      captureError(new Error('Revolut order missing required widget fields'), { orderId, revolut: revolutOrder }, { tag: 'revolut_create_order' })
      return NextResponse.json({ error: 'Răspuns invalid de la procesator de plată.' }, { status: 502 })
    }

    await updateOrderPayment(orderId, 'pending_payment', {
      providerOrderId: revolutOrder.id,
      providerPublicId: revolutOrder.token,
      providerCheckoutUrl: revolutOrder.checkout_url,
      state: revolutOrder.state,
      // B3: persist the historical session list so the NEXT prepare can
      // cancel all of them, including this one if it gets superseded.
      previousProviderOrderIds,
    })

    return NextResponse.json({
      orderId,
      // `publicId` is what Revolut Web SDK widgets expect from createOrder() — it's
      // the order's `token`, not its UUID id. The hosted checkout url is also
      // returned as a fallback for "open in Revolut" links.
      publicId: revolutOrder.token,
      checkoutUrl: revolutOrder.checkout_url,
      providerOrderId: revolutOrder.id,
    })
  } catch (error: unknown) {
    captureError(error, {}, { tag: 'revolut_create_order' })
    return NextResponse.json(
      { error: 'Internal error. Please try again.' },
      { status: 500 }
    )
  }
}
