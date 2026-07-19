/**
 * Issue #2 — GA4 ecommerce funnel events (view_item, add_to_cart,
 * begin_checkout, add_payment_info).
 *
 * The pipeline in `src/lib/analytics.ts` was Meta-only: GA4 received zero
 * ecommerce events. These tests assert that the same tracking functions now
 * ALSO emit the standard GA4 ecommerce schema through the gtag transport
 * (`window.gtag('event', …)`), without changing the Meta payloads:
 *   - top-level `currency` + `value`, `items[]` with `item_id` matching the
 *     Google Merchant Center offerId (`<category>_<slug>`, e.g.
 *     `furniture_aria-console` — NOT the Meta content_id
 *     `furniture__aria-console`)
 *   - the single-market currency (EUR) + `market`/`country` params
 *   - the same marketing-consent gate as the Meta events
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  trackProductView,
  trackAddToCart,
  trackCartInitiateCheckout,
  trackAddPaymentInfo,
} from '@/lib/analytics'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let gtagMock: ReturnType<typeof vi.fn>
let fbqMock: ReturnType<typeof vi.fn>

function ga4Calls(eventName: string) {
  return gtagMock.mock.calls.filter((c) => c[0] === 'event' && c[1] === eventName)
}

describe('Issue #2 — GA4 ecommerce funnel events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gtagMock = vi.fn()
    fbqMock = vi.fn()
    window.gtag = gtagMock as unknown as Window['gtag']
    window.fbq = fbqMock as unknown as Window['fbq']
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn(() => true),
      configurable: true,
      writable: true,
    })
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'gtag')
    Reflect.deleteProperty(window, 'fbq')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('view_item fires from the product page with the Merchant Center offerId as item_id', () => {
    // aria-console is a real product in the template catalog (furniture category)
    trackProductView({ pathname: '/furniture/[slug]', slug: 'aria-console' })

    const calls = ga4Calls('view_item')
    expect(calls).toHaveLength(1)
    const params = calls[0][2] as Record<string, unknown>
    expect(params.currency).toBe('EUR')
    expect(typeof params.value).toBe('number')
    expect(params.value as number).toBeGreaterThan(0)
    expect(params.market).toBe('main')
    expect(params.country).toBe('GB')
    const items = params.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    // Merchant feed g:id is `<category>_<slug>` — NOT the Meta `furniture__aria-console`.
    expect(items[0].item_id).toBe('furniture_aria-console')
    expect(typeof items[0].item_name).toBe('string')
    expect(items[0].price).toBe(params.value)
    expect(items[0].quantity).toBe(1)

    // Meta ViewContent unchanged — still fires with the catalog content_ids.
    const vc = fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'ViewContent')
    expect(vc).toHaveLength(1)
    expect((vc[0][2] as Record<string, unknown>).content_ids).toEqual([
      'furniture__aria-console',
    ])
  })

  it('add_to_cart fires with items derived from the cart content id, Meta payload unchanged', () => {
    trackAddToCart('Aria Console Table', '2', 498, undefined, {
      contentId: 'furniture__aria-console',
      currency: 'EUR',
    })

    const calls = ga4Calls('add_to_cart')
    expect(calls).toHaveLength(1)
    const params = calls[0][2] as Record<string, unknown>
    expect(params.currency).toBe('EUR')
    expect(params.value).toBe(498)
    const items = params.items as Array<Record<string, unknown>>
    expect(items).toEqual([
      expect.objectContaining({
        item_id: 'furniture_aria-console',
        item_name: 'Aria Console Table',
        price: 249,
        quantity: 2,
      }),
    ])

    // Meta AddToCart must be byte-for-byte what it was before GA4 existed.
    expect(fbqMock).toHaveBeenCalledWith(
      'track',
      'AddToCart',
      {
        content_name: 'Aria Console Table',
        content_type: 'product',
        quantity: '2',
        value: 498,
        currency: 'EUR',
      },
      expect.objectContaining({ eventID: expect.any(String) }),
    )
  })

  it('begin_checkout fires with per-item quantities and prices', () => {
    trackCartInitiateCheckout({
      contentIds: ['furniture__aria-console', 'lighting__halo-table-lamp'],
      numItems: 3,
      value: 800,
      currency: 'EUR',
      items: [
        { id: 'furniture__aria-console', name: 'Aria Console Table', price: 249, quantity: 2 },
        { id: 'lighting__halo-table-lamp', name: 'Halo Table Lamp', price: 149, quantity: 1 },
      ],
    })

    const calls = ga4Calls('begin_checkout')
    expect(calls).toHaveLength(1)
    const params = calls[0][2] as Record<string, unknown>
    expect(params.currency).toBe('EUR')
    expect(params.value).toBe(800)
    expect(params.items).toEqual([
      expect.objectContaining({
        item_id: 'furniture_aria-console',
        quantity: 2,
        price: 249,
      }),
      expect.objectContaining({
        item_id: 'lighting_halo-table-lamp',
        quantity: 1,
        price: 149,
      }),
    ])
  })

  it('uses the single market currency and country (EUR / GB)', () => {
    trackCartInitiateCheckout({
      contentIds: ['furniture__aria-console'],
      numItems: 1,
      value: 249,
      currency: 'EUR',
      items: [{ id: 'furniture__aria-console', name: 'Aria Console Table', price: 249, quantity: 1 }],
    })

    const params = ga4Calls('begin_checkout')[0][2] as Record<string, unknown>
    expect(params.currency).toBe('EUR')
    expect(params.market).toBe('main')
    expect(params.country).toBe('GB')
  })

  it('add_payment_info fires with payment_type', () => {
    trackAddPaymentInfo({
      contentIds: ['furniture__aria-console'],
      numItems: 1,
      value: 249,
      currency: 'EUR',
      paymentMethod: 'cod',
      items: [{ id: 'furniture__aria-console', name: 'Aria Console Table', price: 249, quantity: 1 }],
    })

    const calls = ga4Calls('add_payment_info')
    expect(calls).toHaveLength(1)
    const params = calls[0][2] as Record<string, unknown>
    expect(params.payment_type).toBe('cod')
    expect(params.currency).toBe('EUR')
    expect((params.items as unknown[]).length).toBe(1)
  })

  it('sends nothing to GA4 when marketing consent is denied', () => {
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: false }

    trackProductView({ pathname: '/furniture/[slug]', slug: 'aria-console' })
    trackAddToCart('Aria Console Table', '1', 249, undefined, {
      contentId: 'furniture__aria-console',
    })
    trackCartInitiateCheckout({
      contentIds: ['furniture__aria-console'],
      numItems: 1,
      value: 249,
    })
    trackAddPaymentInfo({
      contentIds: ['furniture__aria-console'],
      numItems: 1,
      value: 249,
      paymentMethod: 'cod',
    })

    expect(gtagMock).not.toHaveBeenCalled()
    expect(fbqMock).not.toHaveBeenCalled()
  })

  it('queues events into window.dataLayer (gtag command queue) before gtag.js loads', () => {
    Reflect.deleteProperty(window, 'gtag')
    window.dataLayer = []

    trackAddToCart('Aria Console Table', '1', 249, undefined, {
      contentId: 'furniture__aria-console',
      currency: 'EUR',
    })

    const queued = (window.dataLayer as unknown[]).filter((entry) => {
      const args = entry as { [index: number]: unknown; length?: number }
      return args[0] === 'event' && args[1] === 'add_to_cart'
    })
    expect(queued).toHaveLength(1)
    // gtag.js only replays `arguments` objects — a plain array push would be
    // silently ignored by the real library.
    expect(Array.isArray(queued[0])).toBe(false)
  })
})
