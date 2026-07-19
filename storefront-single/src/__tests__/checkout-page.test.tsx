import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from './test-utils'
import { useRouter } from '@/lib/nav'
import { CHECKOUT_SHIPPING_DRAFT_KEY } from '@/lib/checkout-shipping-draft'

const { mockPush, mockClearCart } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockClearCart: vi.fn(),
}))

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: [
      {
        id: 'furniture__oslo-nightstand',
        productType: 'furniture',
        productName: 'Oslo Nightstand',
        slug: 'oslo-nightstand',
        shortName: 'Oslo Nightstand',
        quantity: 1,
        unitPrice: 1899,
        image: '/test.png',
      },
    ],
    totalPrice: 1899,
    totalItems: 1,
    clearCart: mockClearCart,
  }),
}))

vi.mock('@/components/RevolutPaymentWidgets', () => ({
  RevolutPaymentWidgets: ({ onSuccess }: { onSuccess: (orderId: string) => void }) => (
    <button type="button" onClick={() => onSuccess('ABCD1234')}>
      Simulează plata Revolut
    </button>
  ),
}))

import CheckoutPage from '@/app/checkout/page'

describe('CheckoutPage shipping draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>)
  })

  it('restores a saved shipping draft and persists later edits', async () => {
    localStorage.setItem(
      CHECKOUT_SHIPPING_DRAFT_KEY,
      JSON.stringify({
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@test.ro',
        phone: '+40740000000',
        county: 'Cluj',
        city: 'Cluj-Napoca',
        address: 'Str. Exemplu 1',
        country: 'România',
        postalCode: '400000',
      })
    )

    render(<CheckoutPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ana')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Cluj-Napoca')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Jane'), {
      target: { value: 'Irina' },
    })

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        CHECKOUT_SHIPPING_DRAFT_KEY,
        expect.stringContaining('"firstName":"Irina"')
      )
    })
  })

  it('persists incomplete shipping edits so cancelled payment returns can restore them', async () => {
    localStorage.setItem('sf_user_email', 'partial@test.ro')

    render(<CheckoutPage />)

    await waitFor(() => {
      expect(screen.getByText('partial@test.ro')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Jane'), {
      target: { value: 'PartialPersist' },
    })

    await waitFor(() => {
      expect(localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)).toEqual(
        expect.stringContaining('"firstName":"PartialPersist"'),
      )
    })
  })

  it('keeps the saved customer data after a successful Revolut payment', async () => {
    // Full shipping draft so the wizard can advance to the payment step
    // (the Revolut widget only renders once shipping is valid).
    localStorage.setItem(
      CHECKOUT_SHIPPING_DRAFT_KEY,
      JSON.stringify({
        firstName: 'Ion',
        lastName: 'Popescu',
        email: 'ion@test.ro',
        phone: '+40712345678',
        county: 'Ilfov',
        city: 'București',
        address: 'Str. Test nr. 10',
        country: 'România',
        postalCode: '012345',
      })
    )

    render(<CheckoutPage />)

    // Wait for the draft to hydrate (effect-driven), then advance to payment.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ion')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    // Now the mocked RevolutPaymentWidgets is rendered and we can fire its
    // success callback.
    fireEvent.click(screen.getByRole('button', { name: /simulează plata revolut/i }))

    expect(localStorage.removeItem).not.toHaveBeenCalledWith(CHECKOUT_SHIPPING_DRAFT_KEY)
    expect(localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)).toEqual(
      expect.stringContaining('"firstName":"Ion"'),
    )
    expect(mockPush).toHaveBeenCalledWith('/order-confirmation/ABCD1234')
  })

  it('renders compact payment options and submits the experiment assignment', async () => {
    localStorage.setItem(
      CHECKOUT_SHIPPING_DRAFT_KEY,
      JSON.stringify({
        firstName: 'Ion',
        lastName: 'Popescu',
        email: 'ion@test.ro',
        phone: '+40712345678',
        county: 'Ilfov',
        city: 'București',
        address: 'Str. Test nr. 10',
        country: 'România',
        postalCode: '012345',
      })
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          orderId: 'RMBR1234',
          success: true,
          shippingCost: 0,
          totalPrice: 1519,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(<CheckoutPage forcedCheckoutPaymentVariant="compact_payment_options" />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ion')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    expect(screen.getByText(/choose your payment method/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /pay on delivery/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm order.*pay on delivery/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/order-confirmation/RMBR1234')
    })
    expect(localStorage.removeItem).not.toHaveBeenCalledWith(CHECKOUT_SHIPPING_DRAFT_KEY)
    expect(localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)).toEqual(
      expect.stringContaining('"firstName":"Ion"'),
    )

    const orderCall = fetchSpy.mock.calls.find(([url]) => url === '/api/order')
    expect(orderCall).toBeTruthy()
    const body = JSON.parse(orderCall?.[1]?.body as string)
    expect(body.experiments).toEqual({
      checkoutPaymentUi: 'compact_payment_options',
    })

    fetchSpy.mockRestore()
  })
})
