/**
 * The browser Purchase pixel must fire on the mobile wallet return path
 * (ported from the live app, issue #12 there). `/revolut-pay/return/[result]`
 * resolves the public order token straight to `/order-confirmation/[orderId]`,
 * bypassing checkout's `handlePaymentSuccess`, so only the webhook CAPI
 * Purchase was sent.
 *
 * Fix under test: the confirmation page fires the Pixel Purchase
 * (eventID = orderId) when the order is paid and a localStorage marker
 * (`sf_purchase_fired_<orderId>`) is absent; the checkout success path sets
 * the same marker so the normal flow doesn't double-fire. Meta dedups
 * identical event_ids anyway — the marker is hygiene, not correctness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { CHECKOUT_SHIPPING_DRAFT_KEY } from '@/lib/checkout-shipping-draft'

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
    totalItems: 1,
    totalPrice: 249,
    clearCart: vi.fn(),
  }),
}))

vi.mock('@/components/RevolutPaymentWidgets', () => ({
  RevolutPaymentWidgets: ({ onSuccess }: { onSuccess: (orderId: string) => void }) => (
    <button type="button" onClick={() => onSuccess('ABCD1234')}>
      Simulate Revolut payment
    </button>
  ),
}))

import ConfirmarePage from '@/app/order-confirmation/[orderId]/page'
import CheckoutPage from '@/app/checkout/page'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let fbqMock: ReturnType<typeof vi.fn>

function purchaseCalls() {
  return fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'Purchase')
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
  currency: 'EUR',
  payment: { provider: 'revolut', currency: 'EUR', state: 'completed' },
}

async function renderConfirmation(orderId = 'ABCD1234') {
  const ui = await ConfirmarePage({
    params: Promise.resolve({ orderId }),
  })
  renderWithProviders(ui)
}

describe('Purchase pixel on the confirmation page (wallet return path)', () => {
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
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('fires Purchase with eventID=orderId, value and currency for a paid order without a marker', async () => {
    mockFindOrderById.mockResolvedValue(PAID_ORDER)

    await renderConfirmation()

    await waitFor(() => expect(purchaseCalls()).toHaveLength(1))
    const [, , params, dedup] = purchaseCalls()[0]
    expect(params).toEqual(
      expect.objectContaining({
        content_ids: ['furniture__aria-console'],
        content_type: 'product',
        num_items: 1,
        value: 224,
        currency: 'EUR',
      }),
    )
    expect(dedup).toEqual({ eventID: 'ABCD1234' })
    // The marker is written so a refresh doesn't re-fire.
    expect(localStorage.getItem('sf_purchase_fired_ABCD1234')).toBe('1')
  })

  it('does not fire when the marker is already present (refresh / normal checkout flow)', async () => {
    mockFindOrderById.mockResolvedValue(PAID_ORDER)
    localStorage.setItem('sf_purchase_fired_ABCD1234', '1')

    await renderConfirmation()

    await new Promise((r) => setTimeout(r, 50))
    expect(purchaseCalls()).toHaveLength(0)
  })

  it('does not fire for an unpaid (pending_payment) order', async () => {
    mockFindOrderById.mockResolvedValue({
      ...PAID_ORDER,
      status: 'pending_payment',
      payment: { provider: 'revolut', currency: 'EUR', state: 'pending' },
    })

    await renderConfirmation()

    await new Promise((r) => setTimeout(r, 50))
    expect(purchaseCalls()).toHaveLength(0)
  })

  it('checkout success path sets the marker so confirmation will not double-fire', async () => {
    // Full shipping draft so the wizard can advance to the payment step.
    localStorage.setItem(
      CHECKOUT_SHIPPING_DRAFT_KEY,
      JSON.stringify({
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@test.com',
        phone: '+40712345678',
        county: 'Greater London',
        city: 'London',
        address: '1 Example Street',
        country: 'United Kingdom',
        postalCode: 'SW1A 1AA',
      }),
    )

    renderWithProviders(<CheckoutPage />)

    fireEvent.click(await screen.findByText(/Continue to payment/))
    fireEvent.click(await screen.findByText('Simulate Revolut payment'))

    await waitFor(() => expect(purchaseCalls()).toHaveLength(1))
    expect(purchaseCalls()[0][3]).toEqual({ eventID: 'ABCD1234' })
    expect(localStorage.getItem('sf_purchase_fired_ABCD1234')).toBe('1')
  })
})
