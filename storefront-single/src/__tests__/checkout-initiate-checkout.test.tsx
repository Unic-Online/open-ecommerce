/**
 * InitiateCheckout must fire on direct /checkout visits, not only via the
 * cart sidebar (ported from the live app, issue #9 there). Recovery links,
 * bookmarks and FloatingCartBar paths land on /checkout without ever passing
 * through CartSidebar.handleCheckout, so Meta saw no InitiateCheckout for
 * those sessions.
 *
 * Fix under test: the checkout page fires InitiateCheckout on mount, guarded
 * by a sessionStorage marker (`sf_ic_fired`, keyed per cart signature) that
 * the sidebar path shares — so sidebar→checkout fires exactly once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, cleanup } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { computeOrderTotal } from '@/lib/pricing'
import { MARKET } from '@/site.config'
import type { CartItemData } from '@/lib/types'

const cartState: { items: CartItemData[] } = { items: [] }

const SAMPLE_ITEM: CartItemData = {
  id: 'furniture__aria-console',
  productType: 'furniture',
  productName: 'Aria Console Table',
  slug: 'aria-console',
  shortName: 'Aria Console Table',
  quantity: 1,
  unitPrice: 249,
  image: '/test.png',
}

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: cartState.items,
    totalItems: cartState.items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: cartState.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    clearCart: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    isCartOpen: true,
    setCartOpen: vi.fn(),
  }),
}))

vi.mock('@/components/RevolutPaymentWidgets', () => ({
  RevolutPaymentWidgets: () => null,
}))

import CheckoutPage from '@/app/checkout/page'
import CartSidebar from '@/components/CartSidebar'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let fbqMock: ReturnType<typeof vi.fn>

function icCalls() {
  return fbqMock.mock.calls.filter(
    (c) => c[0] === 'track' && c[1] === 'InitiateCheckout',
  )
}

describe('InitiateCheckout coverage on direct checkout visits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fbqMock = vi.fn()
    window.fbq = fbqMock as unknown as Window['fbq']
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn(() => true),
      configurable: true,
      writable: true,
    })
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch
    localStorage.clear()
    sessionStorage.clear()
    cartState.items = [SAMPLE_ITEM]
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('fires InitiateCheckout with cart contents on direct checkout mount', async () => {
    renderWithProviders(<CheckoutPage />)

    const expectedTotal = computeOrderTotal(cartState.items, {
      shipping: MARKET.shipping,
    }).total

    await waitFor(() => expect(icCalls()).toHaveLength(1))
    expect(icCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['furniture__aria-console'],
        content_type: 'product',
        num_items: 1,
        value: expectedTotal,
        currency: 'EUR',
      }),
    )
  })

  it('fires exactly once for the sidebar → checkout sequence', async () => {
    renderWithProviders(<CartSidebar />)
    fireEvent.click(screen.getByText('Proceed to checkout'))

    await waitFor(() => expect(icCalls()).toHaveLength(1))

    cleanup()
    renderWithProviders(<CheckoutPage />)

    // Give the checkout mount effect a chance to (incorrectly) double-fire.
    await waitFor(() =>
      expect(screen.getByText('Checkout')).toBeInTheDocument(),
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(icCalls()).toHaveLength(1)
  })

  it('does not fire on an empty cart', async () => {
    cartState.items = []
    renderWithProviders(<CheckoutPage />)

    await new Promise((r) => setTimeout(r, 50))
    expect(icCalls()).toHaveLength(0)
  })

  it('does not fire (and does not burn the marker) without marketing consent', async () => {
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: false }
    renderWithProviders(<CheckoutPage />)

    await new Promise((r) => setTimeout(r, 50))
    expect(icCalls()).toHaveLength(0)
    expect(sessionStorage.getItem('sf_ic_fired')).toBeNull()
  })
})
