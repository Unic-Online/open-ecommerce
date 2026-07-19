/**
 * Meta Pixel ViewContent must fire on every product page with content_ids
 * matching the catalog ids (`<category>__<slug>`) and the configured market
 * currency (EUR — the old implementation hardcoded RON and sent no
 * content_ids, so the event never joined up with AddToCart / Purchase for
 * DPA retargeting). Ported from the live app (issue #8 there).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { usePathname } from '@/lib/nav'
import { getSearchableProducts } from '@/lib/product-search-index'

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
    vi.mocked(usePathname).mockReturnValue('/')
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('fires ViewContent with content_ids/value/EUR on a furniture product page', async () => {
    const aria = getSearchableProducts().find((p) => p.slug === 'aria-console')
    expect(aria).toBeDefined()

    vi.mocked(usePathname).mockReturnValue('/furniture/aria-console')

    renderWithProviders(<MetaPixel />)

    await waitFor(() => expect(viewContentCalls()).toHaveLength(1))
    expect(viewContentCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['furniture__aria-console'],
        content_type: 'product',
        content_name: aria!.shortName,
        value: aria!.price,
        currency: 'EUR',
      }),
    )
  })

  it('fires ViewContent on a lighting product page (second category)', async () => {
    const halo = getSearchableProducts().find((p) => p.slug === 'halo-table-lamp')
    expect(halo).toBeDefined()

    vi.mocked(usePathname).mockReturnValue('/lighting/halo-table-lamp')

    renderWithProviders(<MetaPixel />)

    await waitFor(() => expect(viewContentCalls()).toHaveLength(1))
    expect(viewContentCalls()[0][2]).toEqual(
      expect.objectContaining({
        content_ids: ['lighting__halo-table-lamp'],
        value: halo!.price,
        currency: 'EUR',
      }),
    )
  })

  it('does not fire ViewContent on non-product two-segment pages', async () => {
    vi.mocked(usePathname).mockReturnValue('/admin/orders')

    renderWithProviders(<MetaPixel />)

    // Wait out the 300ms PageView/ViewContent timer before asserting.
    await waitFor(() =>
      expect(fbqMock.mock.calls.some((c) => c[1] === 'PageView')).toBe(true),
    )
    expect(viewContentCalls()).toHaveLength(0)
  })
})
