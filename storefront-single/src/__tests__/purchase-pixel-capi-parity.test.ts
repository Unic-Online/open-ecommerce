/**
 * Browser Pixel Purchase ↔ server CAPI Purchase custom_data parity.
 *
 * The server CAPI Purchase (lib/meta-capi.ts) sends `content_name` (joined
 * product names), `shipping` (shipping cost) and
 * `delivery_category: 'home_delivery'`. Meta dedupes the browser/server pair
 * by event_id (= orderId) — the deduped event must not carry asymmetric
 * custom_data, so the browser `fbq('track','Purchase',…)` must send the same
 * three fields. trackPurchaseOnce already receives `items` (with names) and
 * `shipping` from both call sites (checkout firePurchase +
 * OrderConfirmationPurchaseTracker).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { trackPurchase } from '@/lib/analytics'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let fbqMock: ReturnType<typeof vi.fn>
let gtagMock: ReturnType<typeof vi.fn>

const PURCHASE_OPTIONS = {
  orderId: 'PARITY01',
  contentIds: ['furniture__aria-console', 'furniture__oslo-nightstand'],
  numItems: 3,
  value: 487,
  currency: 'EUR',
  shipping: 15,
  items: [
    { id: 'furniture__aria-console', name: 'Aria Console Table', price: 249, quantity: 1 },
    { id: 'furniture__oslo-nightstand', name: 'Oslo Nightstand', price: 119, quantity: 2 },
  ],
}

function metaPurchaseParams(): Record<string, unknown> {
  const calls = fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'Purchase')
  expect(calls).toHaveLength(1)
  return calls[0][2] as Record<string, unknown>
}

describe('browser Purchase pixel — custom_data parity with server CAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fbqMock = vi.fn()
    gtagMock = vi.fn()
    window.fbq = fbqMock as unknown as Window['fbq']
    window.gtag = gtagMock as unknown as Window['gtag']
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq')
    Reflect.deleteProperty(window, 'gtag')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('sends content_name (joined item names), shipping and delivery_category like the server CAPI', () => {
    trackPurchase(PURCHASE_OPTIONS)

    const params = metaPurchaseParams()
    expect(params.content_name).toBe('Aria Console Table, Oslo Nightstand')
    expect(params.shipping).toBe(15)
    expect(params.delivery_category).toBe('home_delivery')

    // The pre-existing fields are untouched.
    expect(params.content_ids).toEqual(['furniture__aria-console', 'furniture__oslo-nightstand'])
    expect(params.content_type).toBe('product')
    expect(params.num_items).toBe(3)
    expect(params.value).toBe(487)
    expect(params.currency).toBe('EUR')
  })

  it('sends shipping: 0 for free-shipping orders (server CAPI sends 0 too, not "missing")', () => {
    trackPurchase({ ...PURCHASE_OPTIONS, orderId: 'PARITY02', shipping: 0 })

    expect(metaPurchaseParams().shipping).toBe(0)
  })

  it('omits content_name and shipping when the call site has neither, but keeps delivery_category', () => {
    trackPurchase({
      orderId: 'PARITY03',
      contentIds: ['furniture__aria-console'],
      numItems: 1,
      value: 249,
    })

    const params = metaPurchaseParams()
    expect(params).not.toHaveProperty('content_name')
    expect(params).not.toHaveProperty('shipping')
    expect(params.delivery_category).toBe('home_delivery')
  })

  it('does not leak the Meta-only fields into the GA4 purchase params (GA4 keeps its own schema)', () => {
    trackPurchase(PURCHASE_OPTIONS)

    const ga4 = gtagMock.mock.calls.filter((c) => c[0] === 'event' && c[1] === 'purchase')
    expect(ga4).toHaveLength(1)
    const params = ga4[0][2] as Record<string, unknown>
    expect(params).not.toHaveProperty('content_name')
    expect(params).not.toHaveProperty('delivery_category')
    // GA4 already had its own `shipping` param — unchanged.
    expect(params.shipping).toBe(15)
    expect(params.transaction_id).toBe('PARITY01')
  })
})
