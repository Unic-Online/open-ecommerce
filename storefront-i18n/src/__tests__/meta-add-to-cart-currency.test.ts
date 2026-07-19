/**
 * Meta AddToCart hardcoded `currency: 'RON'` while every call site
 * (ProductBuyBox, FloatingCartBar) passes the per-market price as `value` —
 * so on the EUR market the Pixel AddToCart (and its CAPI mirror) reported
 * EUR amounts labeled as RON, corrupting Meta value optimization. The GA4
 * mirror already used the market currency; this pins the Meta payload to
 * the same `options.currency`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackAddToCart } from '@/lib/analytics'

type ConsentWindow = { __sfConsent?: { marketing?: boolean } }

let fbqMock: ReturnType<typeof vi.fn>
let beaconMock: ReturnType<typeof vi.fn>

function addToCartCalls() {
  return fbqMock.mock.calls.filter((c) => c[0] === 'track' && c[1] === 'AddToCart')
}

async function beaconBodies(): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = []
  for (const call of beaconMock.mock.calls) {
    const blob = call[1] as Blob
    out.push(JSON.parse(await blob.text()) as Record<string, unknown>)
  }
  return out
}

describe('Meta AddToCart currency follows the market', () => {
  beforeEach(() => {
    fbqMock = vi.fn()
    window.fbq = fbqMock as unknown as Window['fbq']
    ;(window as unknown as ConsentWindow).__sfConsent = { marketing: true }
    beaconMock = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconMock,
      configurable: true,
      writable: true,
    })
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'fbq')
    delete (window as unknown as ConsentWindow).__sfConsent
  })

  it('sends EUR on the Meta AddToCart payload for the EUR market', async () => {
    trackAddToCart('Aria Console Table', '1', 249, undefined, {
      contentId: 'furniture__aria-console',
      currency: 'EUR',
      market: 'english',
    })

    expect(addToCartCalls()).toHaveLength(1)
    const params = addToCartCalls()[0][2] as Record<string, unknown>
    expect(params.value).toBe(249)
    expect(params.currency).toBe('EUR')

    // The CAPI mirror carries the same custom_data.
    const bodies = await beaconBodies()
    const capi = bodies.find((b) => b.eventName === 'AddToCart')
    expect(capi).toBeDefined()
    expect((capi!.customData as Record<string, unknown>).currency).toBe('EUR')
  })

  it('keeps RON as the default when no currency option is passed', () => {
    trackAddToCart('Consolă Aria', '2', 2398)

    expect(addToCartCalls()).toHaveLength(1)
    const params = addToCartCalls()[0][2] as Record<string, unknown>
    expect(params.currency).toBe('RON')
    expect(params.value).toBe(2398)
  })
})
