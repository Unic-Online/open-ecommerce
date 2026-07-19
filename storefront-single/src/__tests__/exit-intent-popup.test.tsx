import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { usePathname } from '@/lib/nav'

const { mockCartItems } = vi.hoisted(() => ({
  mockCartItems: { current: [{ id: 'lake-blue__2-5mm__500g' }] as Array<{ id: string }> },
}))

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: mockCartItems.current,
    totalItems: mockCartItems.current.length,
    totalPrice: 0,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    isCartOpen: false,
    setCartOpen: vi.fn(),
  }),
}))

import ExitIntentPopup from '@/plugins/abandoned-cart/client/ExitIntentPopup'
import { clearExitIntentState } from '@/plugins/abandoned-cart/client/exit-intent-detector'
import { renderWithProviders } from './test-utils'

const setPath = (p: string) =>
  vi.mocked(usePathname).mockReturnValue(p as ReturnType<typeof usePathname>)

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    value,
    configurable: true,
  })
}

// Realistic mobile flick: touch provenance + a per-frame stream of small
// upward deltas (scroll events fire once per display frame on phones — the
// detector must never depend on one giant jump).
function fireMobileFlickUp(fromY = 900, step = 80, frames = 6) {
  fireEvent.touchStart(document.body)
  let y = fromY
  setScrollY(y)
  fireEvent.scroll(document)
  for (let i = 0; i < frames; i++) {
    y = Math.max(0, y - step)
    setScrollY(y)
    fireEvent.scroll(document)
  }
}

function fireMouseLeaveTop() {
  // Simulate mouse exiting the document through the top edge.
  // testing-library's fireEvent wraps in act(), avoiding stale snapshots
  // when the listener fires a setState synchronously.
  fireEvent.mouseOut(document, { clientY: -10, relatedTarget: null })
}

function fireDocumentMouseLeaveTop() {
  fireEvent.mouseLeave(document.documentElement, {
    clientY: -10,
    relatedTarget: null,
  })
}

describe('ExitIntentPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    clearExitIntentState()
    sessionStorage.clear()
    document.body.style.overflow = ''
    setScrollY(0)
    window.history.replaceState(null, document.title, '/')
    setPath('/')
    // Default: cart has at least one item so the popup is allowed to fire.
    mockCartItems.current = [{ id: 'lake-blue__2-5mm__500g' }]
  })

  it('does not render when the cart is empty (only abandoned-cart use case)', () => {
    mockCartItems.current = []
    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render until exit-intent fires', () => {
    renderWithProviders(<ExitIntentPopup />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the slide-in panel after a top-edge mouseout', () => {
    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()
    expect(
      screen.getByRole('dialog', { name: /you weren't leaving without your basket/i })
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your email address here/i)).toBeInTheDocument()
  })

  it('renders after a real document mouseleave through the top edge', () => {
    renderWithProviders(<ExitIntentPopup />)
    fireDocumentMouseLeaveTop()
    expect(
      screen.getByRole('dialog', { name: /you weren't leaving without your basket/i })
    ).toBeInTheDocument()
  })

  it('ignores upward motion right after a confirmed tap on a navigation link', () => {
    const link = document.createElement('a')
    link.href = '/furniture/oslo-nightstand'
    link.textContent = 'Oslo Nightstand'
    document.body.appendChild(link)

    renderWithProviders(<ExitIntentPopup />)
    // A confirmed tap (click) precedes smooth scroll-to-top / nav-driven
    // scroll jumps — suppressed even if the motion itself looks like a flick.
    fireEvent.click(link)
    fireMobileFlickUp()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    link.remove()
  })

  it('ignores the scroll-lock jump after tapping an add-to-cart/cart button', () => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Add to basket'
    document.body.appendChild(button)

    renderWithProviders(<ExitIntentPopup />)
    fireEvent.touchStart(button)
    fireEvent.touchEnd(button)
    fireEvent.click(button)
    // Cart sidebar's position:fixed lock snaps scrollY to 0 in ONE event.
    setScrollY(900)
    fireEvent.scroll(document)
    setScrollY(0)
    fireEvent.scroll(document)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    button.remove()
  })

  it('renders on a genuine fast mobile upward flick (per-frame stream)', () => {
    renderWithProviders(<ExitIntentPopup />)

    fireMobileFlickUp()

    expect(
      screen.getByRole('dialog', { name: /you weren't leaving without your basket/i })
    ).toBeInTheDocument()
  })

  it('does not render on a fast upward scroll without touch provenance', () => {
    renderWithProviders(<ExitIntentPopup />)

    // Same stream, no touchstart — desktop wheel or programmatic scrolling.
    let y = 900
    setScrollY(y)
    fireEvent.scroll(document)
    for (let i = 0; i < 6; i++) {
      y -= 80
      setScrollY(y)
      fireEvent.scroll(document)
    }

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not intercept mobile back navigation while the flag is off', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    renderWithProviders(<ExitIntentPopup />)
    fireEvent.touchStart(document)
    fireEvent.popState(window)

    expect(pushStateSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    pushStateSpy.mockRestore()
  })

  it('skips on conversion routes (/checkout, /cart, /order-confirmation/*)', () => {
    for (const p of ['/checkout', '/cart', '/order-confirmation/ABCD1234']) {
      setPath(p)
      const { unmount } = renderWithProviders(<ExitIntentPopup />)
      fireMouseLeaveTop()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('does not show when an email is already stored', () => {
    localStorage.setItem('sf_user_email', 'buyer@example.com')
    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('only fires once per session even without explicit dismissal', () => {
    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close snoozes the popup and the active detector also blocks duplicates.
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // A second top-exit in the same detector session should not re-open it.
    fireMouseLeaveTop()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('persists email and shows the success state on submit', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'))

    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()

    const input = screen.getByPlaceholderText(/enter your email address here/i)
    fireEvent.change(input, { target: { value: 'newbuyer@example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(localStorage.getItem('sf_user_email')).toBe('newbuyer@example.com')
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/capture-email',
      expect.objectContaining({ method: 'POST' })
    )
    fetchSpy.mockRestore()
  })

  it('rejects an invalid email and stays open', async () => {
    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()

    const input = screen.getByPlaceholderText(/enter your email address here/i)
    fireEvent.change(input, { target: { value: 'not-an-email' } })

    // Submit the form directly. fireEvent.click on the submit button doesn't
    // reliably trigger the form's onSubmit handler in jsdom — submit dispatch
    // on the form is the canonical path.
    const form = input.closest('form')!
    fireEvent.submit(form)

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(localStorage.getItem('sf_user_email')).toBeNull()
  })

  it('renders English copy when the locale is en', () => {
    renderWithProviders(<ExitIntentPopup />)
    fireMouseLeaveTop()

    expect(
      screen.getByRole('dialog', { name: /you weren't leaving without your basket/i }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter your email address here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })
})
