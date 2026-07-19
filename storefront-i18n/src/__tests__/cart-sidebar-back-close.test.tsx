import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders as render } from './test-utils'
import { useRouter } from '@/i18n/navigation'

// Regression for "back button does nothing while the cart drawer is open":
// the drawer lives in the persistent layout and is full-viewport on phones,
// so without a history entry of its own a back press navigated the page
// invisibly behind it. The drawer now pushes a same-URL sentinel entry
// (history.state.storeCartSentinel) whose pop closes the drawer, and every
// UI close path consumes that entry so back never goes dead.

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

const { mockSetCartOpen, mockPush, mockReplace } = vi.hoisted(() => ({
  mockSetCartOpen: vi.fn(),
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
}))

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: [SAMPLE_ITEM],
    totalPrice: 1899,
    totalItems: 1,
    isCartOpen: true,
    setCartOpen: mockSetCartOpen,
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
  }),
}))

vi.mock('@/lib/analytics', () => ({
  trackCartInitiateCheckoutOnce: vi.fn(),
}))

import CartSidebar from '@/components/CartSidebar'

describe('cart sidebar back-button close (history sentinel)', () => {
  beforeEach(() => {
    // Sentinel written by a previous test survives in jsdom history — reset.
    window.history.replaceState(null, '', '/')
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>)
  })

  it('pushes a same-URL sentinel history entry when the drawer opens', () => {
    render(<CartSidebar />)

    expect(
      (window.history.state as Record<string, unknown>)?.storeCartSentinel,
    ).toBe(true)
  })

  it('closes the drawer when the sentinel entry is popped (back press)', () => {
    render(<CartSidebar />)

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))

    expect(mockSetCartOpen).toHaveBeenCalledWith(false)
  })

  it('does not close when a popstate lands ON the sentinel entry', () => {
    render(<CartSidebar />)

    window.dispatchEvent(
      new PopStateEvent('popstate', { state: { storeCartSentinel: true } }),
    )

    expect(mockSetCartOpen).not.toHaveBeenCalled()
  })

  it('X close consumes the sentinel entry via history.back()', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    render(<CartSidebar />)

    fireEvent.click(screen.getByTestId('cart-close'))

    expect(mockSetCartOpen).toHaveBeenCalledWith(false)
    expect(backSpy).toHaveBeenCalledTimes(1)
  })

  it('checkout replaces the sentinel entry instead of pushing on top of it', () => {
    render(<CartSidebar />)

    fireEvent.click(screen.getByTestId('cart-checkout'))

    expect(mockReplace).toHaveBeenCalledWith('/checkout')
    expect(mockPush).not.toHaveBeenCalled()
  })
})
