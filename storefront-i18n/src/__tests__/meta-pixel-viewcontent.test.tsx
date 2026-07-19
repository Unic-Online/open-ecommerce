/**
 * Meta Pixel ViewContent must fire on EVERY product page with content_ids
 * matching the catalog ids (`<category>__<slug>`) and the market currency.
 *
 * Ported from the live app (issue #8 there): the old implementation matched
 * the last path segment of `usePathname()` — but with localized `pathnames`
 * configured, next-intl returns the route TEMPLATE (`/furniture/[slug]`) for
 * dynamic routes, so the segment was the literal `[slug]` and ViewContent
 * never fired. It also sent no content_ids and hardcoded RON.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { usePathname } from '@/i18n/navigation'
import { getSearchableProducts } from '@/lib/product-search-index'

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

function viewContentCalls() {
  return fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'ViewContent')
}

describe('ViewContent fires on every product page with content_ids + market currency', () => {
  beforeEach(() => {
    fbqMock = vi.fn()
    window.fbq = fbqMock as unknown as Window['fbq']
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
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

  it('fires ViewContent with content_ids/value/RON on a furniture product page (RO)', async () => {
    const aria = getSearchableProducts('ro', 'ro').find((p) => p.slug === 'aria-console')
    expect(aria).toBeDefined()

    vi.mocked(usePathname).mockReturnValue('/furniture/[slug]' as ReturnType<typeof usePathname>)
    mockUseParams.mockReturnValue({ locale: 'ro', slug: 'aria-console' })

    renderWithProviders(<MetaPixel />, { locale: 'ro', market: 'ro' })

    await waitFor(() => expect(viewContentCalls()).toHaveLength(1))
    expect(viewContentCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['furniture__aria-console'],
        content_type: 'product',
        content_name: aria!.shortName,
        value: aria!.price,
        currency: 'RON',
      }),
    )
  })

  it('fires ViewContent on a lighting product page (second category, RO)', async () => {
    const halo = getSearchableProducts('ro', 'ro').find((p) => p.slug === 'halo-table-lamp')
    expect(halo).toBeDefined()

    vi.mocked(usePathname).mockReturnValue('/lighting/[slug]' as ReturnType<typeof usePathname>)
    mockUseParams.mockReturnValue({ locale: 'ro', slug: 'halo-table-lamp' })

    renderWithProviders(<MetaPixel />, { locale: 'ro', market: 'ro' })

    await waitFor(() => expect(viewContentCalls()).toHaveLength(1))
    expect(viewContentCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['lighting__halo-table-lamp'],
        value: halo!.price,
        currency: 'RON',
      }),
    )
  })

  it('fires ViewContent with EUR and the EN-market price on the EN locale', async () => {
    const ariaEn = getSearchableProducts('en', 'english').find((p) => p.slug === 'aria-console')
    expect(ariaEn).toBeDefined()

    vi.mocked(usePathname).mockReturnValue('/furniture/[slug]' as ReturnType<typeof usePathname>)
    mockUseParams.mockReturnValue({ locale: 'en', slug: 'aria-console' })

    renderWithProviders(<MetaPixel />, { locale: 'en', market: 'english' })

    await waitFor(() => expect(viewContentCalls()).toHaveLength(1))
    expect(viewContentCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['furniture__aria-console'],
        content_name: ariaEn!.shortName,
        value: ariaEn!.price,
        currency: 'EUR',
      }),
    )
  })

  it('fires ViewContent when the pathname arrives as the concrete RO localized path', async () => {
    // Defensive path: if the navigation wrapper hands back the localized
    // concrete URL (/mobilier/aria-console) instead of the internal
    // template, the product must still resolve.
    const aria = getSearchableProducts('ro', 'ro').find((p) => p.slug === 'aria-console')
    expect(aria).toBeDefined()

    vi.mocked(usePathname).mockReturnValue(
      '/mobilier/aria-console' as unknown as ReturnType<typeof usePathname>,
    )
    mockUseParams.mockReturnValue({ locale: 'ro' })

    renderWithProviders(<MetaPixel />, { locale: 'ro', market: 'ro' })

    await waitFor(() => expect(viewContentCalls()).toHaveLength(1))
    expect(viewContentCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['furniture__aria-console'],
        value: aria!.price,
        currency: 'RON',
      }),
    )
  })

  it('does not fire ViewContent on non-product pages', async () => {
    vi.mocked(usePathname).mockReturnValue('/checkout' as ReturnType<typeof usePathname>)
    mockUseParams.mockReturnValue({ locale: 'ro' })

    renderWithProviders(<MetaPixel />, { locale: 'ro', market: 'ro' })

    // Wait out the 300ms PageView/ViewContent timer before asserting.
    await waitFor(() =>
      expect(fbqMock.mock.calls.some((c) => c[1] === 'PageView')).toBe(true),
    )
    expect(viewContentCalls()).toHaveLength(0)
  })
})
