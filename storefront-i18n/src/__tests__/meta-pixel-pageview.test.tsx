/**
 * Two PageView regressions in MetaPixel + trackPageView:
 *
 * 1. Post-consent PageView was silently dropped. `trackPageView` burned the
 *    module-level dedup key even when marketing consent was missing (the
 *    inner `trackEvent` returned without sending). When the visitor later
 *    clicked Accept, MetaPixel's consent listener re-called
 *    `trackPageView(pathname)` with the same key — dedup swallowed it, so
 *    the "fresh PageView so the algo sees the post-consent entry" promised
 *    by the listener never fired. Every first-visit accept lost the landing
 *    page PageView (Pixel AND the CAPI mirror).
 *
 * 2. Product→product soft navigation emitted no PageView. `usePathname()`
 *    from `@/i18n/navigation` returns the internal route TEMPLATE for
 *    dynamic routes (`/furniture/[slug]`), so navigating between two
 *    products of the same category kept the dedup key constant and the
 *    second product page was never counted. The fix keys the dedup on the
 *    slug-resolved concrete path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { usePathname } from '@/i18n/navigation'
import { CONSENT_CHANGED_EVENT } from '@/lib/consent'

const { mockUseParams } = vi.hoisted(() => ({
  mockUseParams: vi.fn<() => Record<string, string>>(() => ({})),
}))

// Override the setup.ts mock — MetaPixel needs `useParams` for the slug.
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useParams: mockUseParams,
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

import MetaPixel from '@/components/MetaPixel'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let fbqMock: ReturnType<typeof vi.fn>

function pageViewCalls() {
  return fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'PageView')
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('MetaPixel PageView — consent flip + product-to-product navigation', () => {
  beforeEach(() => {
    fbqMock = vi.fn()
    window.fbq = fbqMock as unknown as Window['fbq']
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn(() => true),
      configurable: true,
      writable: true,
    })
    localStorage.clear()
    sessionStorage.clear()
    mockUseParams.mockReturnValue({})
    vi.mocked(usePathname).mockReturnValue('/')
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('fires the deferred PageView when marketing consent is granted after load', async () => {
    // No consent at mount — the initial PageView attempt must send nothing
    // AND must not burn the dedup key.
    delete (window as unknown as ConsentWindow).__sfConsent
    vi.mocked(usePathname).mockReturnValue(
      '/about' as unknown as ReturnType<typeof usePathname>,
    )
    mockUseParams.mockReturnValue({ locale: 'en' })

    renderWithProviders(<MetaPixel />, { locale: 'en', market: 'english' })

    // Wait out the 300ms mount timer: the consent-blocked attempt happens here.
    await sleep(400)
    expect(pageViewCalls()).toHaveLength(0)

    // Visitor clicks Accept — the CookieBanner sets window.__sfConsent and
    // dispatches the consent-changed event.
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { marketing: true } }),
    )

    // The listener promises a fresh PageView for the post-consent entry.
    await waitFor(() => expect(pageViewCalls()).toHaveLength(1))
  })

  it('fires PageView for each product in a product-to-product soft navigation', async () => {
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    vi.mocked(usePathname).mockReturnValue(
      '/furniture/[slug]' as unknown as ReturnType<typeof usePathname>,
    )
    mockUseParams.mockReturnValue({ locale: 'en', slug: 'aria-console' })

    const { rerender } = renderWithProviders(<MetaPixel />, { locale: 'en', market: 'english' })
    await waitFor(() => expect(pageViewCalls()).toHaveLength(1))

    // Soft-navigate to a sibling product: the template pathname stays
    // constant, only the slug param changes.
    mockUseParams.mockReturnValue({ locale: 'en', slug: 'oslo-nightstand' })
    rerender(<MetaPixel />)

    await waitFor(() => expect(pageViewCalls()).toHaveLength(2))
  })

  it('still dedups PageView for the same product page (no double-fire on re-render)', async () => {
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    vi.mocked(usePathname).mockReturnValue(
      '/lighting/[slug]' as unknown as ReturnType<typeof usePathname>,
    )
    mockUseParams.mockReturnValue({ locale: 'en', slug: 'halo-table-lamp' })

    const { rerender } = renderWithProviders(<MetaPixel />, { locale: 'en', market: 'english' })
    await waitFor(() => expect(pageViewCalls()).toHaveLength(1))

    rerender(<MetaPixel />)
    await sleep(400)
    expect(pageViewCalls()).toHaveLength(1)
  })
})
