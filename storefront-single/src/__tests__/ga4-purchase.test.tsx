/**
 * Issue #3 — GA4 `purchase` event (transaction tracking).
 *
 * GA4 has zero transactions ever: only the Meta Purchase (Pixel + CAPI) fires.
 * These tests assert that the GA4 `purchase` fires wherever the Meta browser
 * Purchase fires — the checkout success path and the confirmation page
 * (wallet-return path) — with:
 *   - `transaction_id` = orderId (same value as the Meta eventID, for
 *     cross-platform reconciliation)
 *   - `value`, per-market `currency` (EUR), optional `shipping`
 *   - `items[]` with item_id = Merchant Center offerId (`furniture_aria-console`)
 *   - the shared `sf_purchase_fired_<orderId>` once-marker so refreshes
 *     never double-send, and the same marketing-consent gate as Meta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'

const { mockFindOrderById } = vi.hoisted(() => ({
  mockFindOrderById: vi.fn(),
}))

vi.mock('@/lib/contacts', () => ({
  findOrderById: mockFindOrderById,
  updateOrderPayment: vi.fn(),
}))

vi.mock('@/lib/revolut', () => ({
  retrieveRevolutOrder: vi.fn(),
}))

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: [],
    totalItems: 0,
    totalPrice: 0,
    clearCart: vi.fn(),
  }),
}))

import { trackPurchaseOnce } from '@/lib/analytics'
import ConfirmationPage from '@/app/order-confirmation/[orderId]/page'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let gtagMock: ReturnType<typeof vi.fn>
let fbqMock: ReturnType<typeof vi.fn>

function ga4Purchases() {
  return gtagMock.mock.calls.filter((c) => c[0] === 'event' && c[1] === 'purchase')
}

const PURCHASE_OPTIONS = {
  orderId: 'ABCD1234',
  contentIds: ['furniture__aria-console'],
  numItems: 1,
  value: 224,
  currency: 'EUR',
  shipping: 0,
  items: [{ id: 'furniture__aria-console', name: 'Aria Console Table', price: 249, quantity: 1 }],
}

const PAID_ORDER = {
  orderId: 'ABCD1234',
  status: 'paid',
  paymentMethod: 'card',
  items: [
    {
      id: 'furniture__aria-console',
      productType: 'furniture',
      productName: 'Aria Console Table',
      slug: 'aria-console',
      shortName: 'Aria Console Table',
      quantity: 1,
      unitPrice: 249,
      image: '/test.png',
    },
  ],
  totalPrice: 224,
  shippingCost: 10,
  currency: 'EUR',
  payment: { provider: 'revolut', currency: 'EUR', state: 'completed' },
}

describe('Issue #3 — GA4 purchase event', () => {
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

  it('fires GA4 purchase with transaction_id = orderId, value, currency, shipping and offerId items', () => {
    trackPurchaseOnce(PURCHASE_OPTIONS)

    const calls = ga4Purchases()
    expect(calls).toHaveLength(1)
    const params = calls[0][2] as Record<string, unknown>
    expect(params.transaction_id).toBe('ABCD1234')
    expect(params.value).toBe(224)
    expect(params.currency).toBe('EUR')
    expect(params.shipping).toBe(0)
    expect(params.items).toEqual([
      expect.objectContaining({
        item_id: 'furniture_aria-console',
        item_name: 'Aria Console Table',
        price: 249,
        quantity: 1,
      }),
    ])

    // The Meta browser Purchase still fires exactly as before, with the
    // SAME orderId as eventID — that is the cross-platform join key.
    const meta = fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'Purchase')
    expect(meta).toHaveLength(1)
    expect(meta[0][3]).toEqual({ eventID: 'ABCD1234' })
  })

  it('does not double-fire on a second call for the same order (refresh guard)', () => {
    trackPurchaseOnce(PURCHASE_OPTIONS)
    trackPurchaseOnce(PURCHASE_OPTIONS)

    expect(ga4Purchases()).toHaveLength(1)
    expect(localStorage.getItem('sf_purchase_fired_ABCD1234')).toBe('1')
  })

  it('skips GA4 and Meta together when the once-marker is already present', () => {
    localStorage.setItem('sf_purchase_fired_ABCD1234', '1')

    trackPurchaseOnce(PURCHASE_OPTIONS)

    expect(ga4Purchases()).toHaveLength(0)
    expect(fbqMock).not.toHaveBeenCalled()
  })

  it('uses the single market currency EUR and country GB', () => {
    trackPurchaseOnce({
      ...PURCHASE_OPTIONS,
      orderId: 'EU123456',
      currency: 'EUR',
    })

    const params = ga4Purchases()[0][2] as Record<string, unknown>
    expect(params.currency).toBe('EUR')
    expect(params.transaction_id).toBe('EU123456')
  })

  it('sends no GA4 purchase when marketing consent is denied, and keeps the order retriable', () => {
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: false }

    trackPurchaseOnce(PURCHASE_OPTIONS)

    expect(gtagMock).not.toHaveBeenCalled()
    expect(fbqMock).not.toHaveBeenCalled()
    // Marker must NOT be burned — if the user grants consent later in the
    // session, the confirmation page can still emit the event.
    expect(localStorage.getItem('sf_purchase_fired_ABCD1234')).toBeNull()
  })

  it('confirmation page (wallet-return path) emits GA4 purchase with items and shipping from the order doc', async () => {
    mockFindOrderById.mockResolvedValue(PAID_ORDER)

    const ui = await ConfirmationPage({
      params: Promise.resolve({ orderId: 'ABCD1234' }),
    })
    renderWithProviders(ui)

    await waitFor(() => expect(ga4Purchases()).toHaveLength(1))
    const params = ga4Purchases()[0][2] as Record<string, unknown>
    expect(params.transaction_id).toBe('ABCD1234')
    expect(params.value).toBe(224)
    expect(params.currency).toBe('EUR')
    expect(params.shipping).toBe(10)
    expect(params.items).toEqual([
      expect.objectContaining({
        item_id: 'furniture_aria-console',
        price: 249,
        quantity: 1,
      }),
    ])
    // Shared once-marker written — a refresh sends neither GA4 nor Meta.
    expect(localStorage.getItem('sf_purchase_fired_ABCD1234')).toBe('1')
  })
})
