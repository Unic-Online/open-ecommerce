import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from './test-utils'
import { useRouter } from '@/lib/nav'
import { CHECKOUT_SHIPPING_DRAFT_KEY } from '@/lib/checkout-shipping-draft'

// Regression for #21: interactive checkout/cart elements must carry stable
// `data-testid` hooks so e2e specs stop selecting them by copy. These
// assertions fail on the pre-fix code (no testids) and only pass once the
// attributes are added to the components.

const SAMPLE_ITEM = {
  id: 'furniture__oslo-nightstand',
  productType: 'furniture' as const,
  productName: 'Oslo Nightstand',
  slug: 'oslo-nightstand',
  shortName: 'Oslo Nightstand',
  quantity: 1,
  unitPrice: 1899,
  image: '/test.png',
}

const { mockPush, mockClearCart, mockRemoveItem, mockUpdateQuantity, mockSetCartOpen } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockClearCart: vi.fn(),
  mockRemoveItem: vi.fn(),
  mockUpdateQuantity: vi.fn(),
  mockSetCartOpen: vi.fn(),
}))

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: [SAMPLE_ITEM],
    totalPrice: 1899,
    totalItems: 1,
    isCartOpen: true,
    setCartOpen: mockSetCartOpen,
    removeItem: mockRemoveItem,
    updateQuantity: mockUpdateQuantity,
    clearCart: mockClearCart,
  }),
}))

vi.mock('@/components/RevolutPaymentWidgets', () => ({
  RevolutPaymentWidgets: () => <div>Revolut widget placeholder</div>,
}))

import CheckoutPage from '@/app/checkout/page'
import CartSidebar from '@/components/CartSidebar'

const FULL_DRAFT = {
  firstName: 'Ion',
  lastName: 'Popescu',
  email: 'ion@test.ro',
  phone: '+40712345678',
  county: 'Ilfov',
  city: 'București',
  address: 'Str. Test nr. 10',
  country: 'România',
  postalCode: '012345',
}

describe('checkout/cart interactive elements expose data-testid (#21)', () => {
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

  it('tags the cart sidebar quantity, remove, close and checkout controls', () => {
    render(<CartSidebar />)

    expect(screen.getByTestId('cart-close')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-decrease')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-increase')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-remove')).toBeInTheDocument()
    expect(screen.getByTestId('cart-checkout')).toBeInTheDocument()
  })

  it('tags the email-step continue control', () => {
    render(<CheckoutPage />)

    expect(screen.getByTestId('checkout-email-continue')).toBeInTheDocument()
  })

  it('tags the shipping and payment step controls', async () => {
    localStorage.setItem(CHECKOUT_SHIPPING_DRAFT_KEY, JSON.stringify(FULL_DRAFT))

    render(<CheckoutPage />)

    // Draft hydration lands the wizard on the shipping step.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ion')).toBeInTheDocument()
    })
    expect(screen.getByTestId('checkout-continue-payment')).toBeInTheDocument()
    expect(screen.getByTestId('checkout-email-edit')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('checkout-continue-payment'))

    // Payment step.
    expect(screen.getByTestId('checkout-shipping-edit')).toBeInTheDocument()
    expect(screen.getByTestId('checkout-pay-method-card')).toBeInTheDocument()
    expect(screen.getByTestId('checkout-pay-method-cod')).toBeInTheDocument()

    // Selecting cod reveals its confirm button.
    fireEvent.click(screen.getByTestId('checkout-pay-method-cod'))
    expect(screen.getByTestId('checkout-confirm-cod')).toBeInTheDocument()
  })
})
