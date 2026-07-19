'use client'

import { useEffect } from 'react'
import { trackPurchaseOnce, type Ga4LineItem } from '@/lib/analytics'

interface Props {
  orderId: string
  contentIds: string[]
  numItems: number
  value: number
  currency?: string
  /** Shipping cost from the order doc — GA4 `shipping` param. */
  shipping?: number
  /** Per-line items from the order doc — GA4 `items[]`. */
  items?: Ga4LineItem[]
}

/**
 * Fires the browser Purchase (Meta Pixel + GA4 mirror) from the
 * confirmation page. Renders nothing. Covers the mobile wallet return path
 * (`/revolut-pay/return/*` → `/order-confirmation/[orderId]`), which
 * bypasses checkout's handlePaymentSuccess — without this, only the webhook
 * CAPI Purchase exists for those orders and GA4 would record no transaction.
 *
 * All guard logic (consent gate, per-order localStorage marker, Meta
 * eventID dedup) lives in `trackPurchaseOnce` in lib/analytics.
 */
export default function OrderConfirmationPurchaseTracker({
  orderId,
  contentIds,
  numItems,
  value,
  currency,
  shipping,
  items,
}: Props) {
  useEffect(() => {
    trackPurchaseOnce({ orderId, contentIds, numItems, value, currency, shipping, items })
    // contentIds/items are fresh arrays per server render; orderId is the real key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  return null
}
