/**
 * Post-consent PageView was silently dropped. `trackPageView` burned the
 * module-level dedup key even when marketing consent was missing (the inner
 * `trackEvent` returned without sending). When the visitor later clicked
 * Accept, MetaPixel's consent listener re-called `trackPageView(pathname)`
 * with the same key — dedup swallowed it, so the "fresh PageView so the algo
 * sees the post-consent entry" promised by the listener never fired. Every
 * first-visit accept lost the landing page PageView (Pixel AND the CAPI
 * mirror). Fix under test: trackPageView checks consent BEFORE burning the
 * dedup key.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import { usePathname } from '@/lib/nav'
import { CONSENT_CHANGED_EVENT } from '@/lib/consent'

import MetaPixel from '@/components/MetaPixel'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let fbqMock: ReturnType<typeof vi.fn>

function pageViewCalls() {
  return fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'PageView')
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('MetaPixel PageView — consent flip', () => {
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
    vi.mocked(usePathname).mockReturnValue('/about')

    renderWithProviders(<MetaPixel />)

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

  it('still dedups PageView for the same page (no double-fire on re-render)', async () => {
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    vi.mocked(usePathname).mockReturnValue('/contact')

    const { rerender } = renderWithProviders(<MetaPixel />)
    await waitFor(() => expect(pageViewCalls()).toHaveLength(1))

    rerender(<MetaPixel />)
    await sleep(400)
    expect(pageViewCalls()).toHaveLength(1)
  })
})
