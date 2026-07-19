import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  CONSENT_CHANGED_EVENT,
  getBootstrapScript,
  writeConsent,
} from '@/lib/consent'

// Baseline tests for the GDPR consent bootstrap and Google Consent Mode v2
// integration. Pinned BEFORE the GTM migration so any regression in
// default-deny, update-on-event, or dataLayer ordering shows up immediately.

type TestWindow = Window & {
  dataLayer?: ArrayLike<unknown>[]
  __sfConsent?: unknown
}

function runBootstrap() {
  // The bootstrap is an IIFE-shaped string; evaluating it in the current
  // jsdom window mirrors how Next's beforeInteractive Script tag injects it.
  new Function(getBootstrapScript())()
}

function consentCalls(): Array<{ command: string; args: Record<string, unknown> }> {
  const dl = (window as TestWindow).dataLayer ?? []
  const out: Array<{ command: string; args: Record<string, unknown> }> = []
  for (const entry of dl) {
    const arr = Array.from(entry as ArrayLike<unknown>)
    if (arr[0] === 'consent') {
      out.push({
        command: arr[1] as string,
        args: arr[2] as Record<string, unknown>,
      })
    }
  }
  return out
}

function clearWindow() {
  localStorage.clear()
  delete (window as TestWindow).__sfConsent
  delete (window as TestWindow).dataLayer
}

// The bootstrap installs an anonymous listener on window for
// `sf:consent-changed`. Across tests the listeners would accumulate
// and writeConsent() would trigger every leaked one. Track and remove
// them per test so update-path counts stay deterministic.
let trackedListeners: Array<{ type: string; listener: EventListenerOrEventListenerObject }> = []
const origAdd = window.addEventListener.bind(window)

function startListenerTracking() {
  trackedListeners = []
  window.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) => {
    trackedListeners.push({ type, listener })
    return origAdd(type, listener, options as AddEventListenerOptions)
  }) as typeof window.addEventListener
}

function stopListenerTracking() {
  for (const { type, listener } of trackedListeners) {
    window.removeEventListener(type, listener)
  }
  window.addEventListener = origAdd
  trackedListeners = []
}

describe('Consent Mode v2 bootstrap — default command', () => {
  beforeEach(() => {
    clearWindow()
    startListenerTracking()
  })
  afterEach(() => {
    stopListenerTracking()
    clearWindow()
  })

  it('initializes window.dataLayer as an array (precondition for any tag)', () => {
    runBootstrap()
    expect(Array.isArray((window as TestWindow).dataLayer)).toBe(true)
  })

  it('default-denies all four GCM v2 categories when no stored consent', () => {
    runBootstrap()
    const calls = consentCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      command: 'default',
      args: {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      },
    })
  })

  it('passes wait_for_update=500 only on default', () => {
    runBootstrap()
    expect(consentCalls()[0].args.wait_for_update).toBe(500)
  })

  it('applies stored fully-granted consent on first hit', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        analytics: true,
        marketing: true,
        givenAt: '2026-05-07T00:00:00.000Z',
        source: 'banner_accept_all',
      }),
    )
    runBootstrap()
    expect(consentCalls()[0].args).toMatchObject({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    })
  })

  it('applies analytics-only stored consent (analytics granted, ads denied)', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        analytics: true,
        marketing: false,
        givenAt: '2026-05-07T00:00:00.000Z',
        source: 'banner_customize',
      }),
    )
    runBootstrap()
    expect(consentCalls()[0].args).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    })
  })

  it('rejects mismatched-version stored state and default-denies', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: 'old',
        necessary: true,
        analytics: true,
        marketing: true,
        givenAt: '2026-05-07T00:00:00.000Z',
        source: 'banner_accept_all',
      }),
    )
    runBootstrap()
    expect(consentCalls()[0].args).toMatchObject({
      ad_storage: 'denied',
      analytics_storage: 'denied',
    })
    expect((window as TestWindow).__sfConsent).toBeNull()
  })

  it('survives corrupt JSON in localStorage and default-denies', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'not json {{{')
    runBootstrap()
    expect(consentCalls()[0].args).toMatchObject({
      ad_storage: 'denied',
      analytics_storage: 'denied',
    })
    expect((window as TestWindow).__sfConsent).toBeNull()
  })

  it('mirrors stored state to window.__sfConsent', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        analytics: true,
        marketing: false,
        givenAt: '2026-05-07T00:00:00.000Z',
        source: 'banner_customize',
      }),
    )
    runBootstrap()
    expect((window as TestWindow).__sfConsent).toMatchObject({
      analytics: true,
      marketing: false,
    })
  })
})

describe('Consent Mode v2 bootstrap — update command', () => {
  beforeEach(() => {
    clearWindow()
    startListenerTracking()
  })
  afterEach(() => {
    stopListenerTracking()
    clearWindow()
  })

  it('emits gtag("consent","update",...) on sf:consent-changed', () => {
    runBootstrap()
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })

    const calls = consentCalls()
    expect(calls).toHaveLength(2) // default + update
    expect(calls[1]).toMatchObject({
      command: 'update',
      args: {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted',
      },
    })
  })

  it('does NOT include wait_for_update on update commands', () => {
    runBootstrap()
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })
    const update = consentCalls().find((c) => c.command === 'update')
    expect(update?.args.wait_for_update).toBeUndefined()
  })

  it('decline emits update with all categories denied', () => {
    runBootstrap()
    writeConsent({ analytics: false, marketing: false, source: 'banner_decline_all' })
    const update = consentCalls().find((c) => c.command === 'update')
    expect(update?.args).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
  })

  it('downgrade path (accept-then-decline) ends in denied state', () => {
    runBootstrap()
    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })
    writeConsent({ analytics: false, marketing: false, source: 'banner_decline_all' })

    const updates = consentCalls().filter((c) => c.command === 'update')
    expect(updates).toHaveLength(2)
    expect(updates[1].args).toMatchObject({
      ad_storage: 'denied',
      analytics_storage: 'denied',
    })
  })

  it('analytics-only update grants analytics_storage but keeps ads denied', () => {
    runBootstrap()
    writeConsent({ analytics: true, marketing: false, source: 'banner_customize' })
    const update = consentCalls().find((c) => c.command === 'update')
    expect(update?.args).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    })
  })
})

describe('Consent Mode + gtag.js ordering (GTM migration invariant)', () => {
  beforeEach(() => {
    clearWindow()
    startListenerTracking()
  })
  afterEach(() => {
    stopListenerTracking()
    clearWindow()
  })

  it('consent default is in dataLayer BEFORE simulated GTM container init', () => {
    // 1. beforeInteractive bootstrap (consent.ts).
    runBootstrap()

    // 2. Simulated GTM init — GTM's first dataLayer.push is the
    //    {'gtm.start': ts, event: 'gtm.js'} marker, which kicks off the
    //    container. Any GA4/Clarity tag the container fires comes after.
    const dl = (window as TestWindow).dataLayer!
    dl.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' } as unknown as ArrayLike<unknown>)

    const flat = dl.map((e) => {
      // Normalize: consent calls are pushed as Arguments, GTM marker
      // is pushed as a plain object — handle both.
      if (typeof e === 'object' && e !== null && 'event' in (e as object)) {
        return { gtmMarker: true, event: (e as unknown as { event: string }).event }
      }
      return Array.from(e as ArrayLike<unknown>)
    })
    const consentDefaultIdx = flat.findIndex(
      (e) => Array.isArray(e) && e[0] === 'consent' && e[1] === 'default',
    )
    const gtmInitIdx = flat.findIndex(
      (e) => !Array.isArray(e) && (e as { gtmMarker?: boolean }).gtmMarker === true,
    )

    expect(consentDefaultIdx).toBeGreaterThanOrEqual(0)
    expect(gtmInitIdx).toBeGreaterThanOrEqual(0)
    // The invariant the GTM migration must preserve: consent state lands
    // in dataLayer before GTM's container script kicks off any tag.
    expect(consentDefaultIdx).toBeLessThan(gtmInitIdx)
  })

  it('CONSENT_STORAGE_KEY and CONSENT_CHANGED_EVENT are stable contracts', () => {
    // The bootstrap is a serialized string with these values inlined.
    // A rename without rebuilding the bootstrap would silently break consent.
    expect(CONSENT_STORAGE_KEY).toBe('sf_consent_v1')
    expect(CONSENT_CHANGED_EVENT).toBe('sf:consent-changed')
    expect(getBootstrapScript()).toContain(CONSENT_STORAGE_KEY)
    expect(getBootstrapScript()).toContain(CONSENT_CHANGED_EVENT)
  })

  it('layout.tsx loads GTM via NEXT_PUBLIC_GTM_ID and the GA4 gtag config disables auto page_view', () => {
    // GA4 is loaded via a direct gtag.js Script tag alongside GTM. The layout
    // must load GTM AND the direct gtag.js block, and the GA4 `gtag('config',…)`
    // call must carry `send_page_view: false` so page_view ownership stays with
    // GTM and there is no double-counting. Scoped to the GA4 config: the
    // optional Google Ads (AW-) config deliberately keeps its page ping (it
    // builds remarketing audiences and captures gclid; it produces no GA4
    // page_view).
    const layout = readFileSync(
      join(process.cwd(), 'src/app/layout.tsx'),
      'utf8',
    )
    expect(layout).toContain('NEXT_PUBLIC_GTM_ID')
    expect(layout).toContain('https://www.googletagmanager.com/gtm.js')
    const configCalls = layout.match(/gtag\(['"]config['"][^)]*\)/g) ?? []
    const ga4Configs = configCalls.filter((c) => c.includes('NEXT_PUBLIC_GA_ID'))
    expect(ga4Configs.length).toBeGreaterThan(0)
    for (const call of ga4Configs) {
      expect(call).toContain('send_page_view: false')
    }
  })

  it('layout.tsx loads the consent bootstrap with strategy="beforeInteractive"', () => {
    // The "beforeInteractive" strategy is what guarantees consent defaults
    // are pushed before any tracker. If this changes, Consent Mode breaks.
    const layout = readFileSync(
      join(process.cwd(), 'src/app/layout.tsx'),
      'utf8',
    )
    expect(layout).toMatch(
      /id=["']sf-consent-bootstrap["'][\s\S]*?strategy=["']beforeInteractive["']/,
    )
  })

  it('layout.tsx preconnects to googletagmanager.com (perf invariant)', () => {
    const layout = readFileSync(
      join(process.cwd(), 'src/app/layout.tsx'),
      'utf8',
    )
    expect(layout).toContain('https://www.googletagmanager.com')
  })
})

describe('Google Ads tag wiring (optional NEXT_PUBLIC_GOOGLE_ADS_ID)', () => {
  const layout = () =>
    readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')

  beforeEach(() => {
    clearWindow()
    startListenerTracking()
  })
  afterEach(() => {
    stopListenerTracking()
    clearWindow()
  })

  it('layout.tsx configures the Google Ads tag from env via the shared gtag.js install', () => {
    // Parameterized: the template ships without an Ads id; an operator sets
    // NEXT_PUBLIC_GOOGLE_ADS_ID (AW-…) and the shared gtag.js install picks
    // it up — no extra script needed.
    const src = layout()
    const configCalls = src.match(/gtag\(['"]config['"][^)]*\)/g) ?? []
    const adsConfigs = configCalls.filter((c) =>
      c.includes('NEXT_PUBLIC_GOOGLE_ADS_ID'),
    )
    expect(adsConfigs).toHaveLength(1)
  })

  it('the Ads config keeps its page ping (no send_page_view: false) — remarketing + gclid capture depend on it', () => {
    // gtag('config', 'AW-…') on each page load is what (a) builds
    // remarketing lists and (b) reads ?gclid= into first-party _gcl_aw
    // cookies (built-in conversion-linker behavior). Disabling its page
    // ping would silently kill both while the tag still "looks" installed.
    const src = layout()
    const configCalls = src.match(/gtag\(['"]config['"][^)]*\)/g) ?? []
    const adsConfig = configCalls.find((c) =>
      c.includes('NEXT_PUBLIC_GOOGLE_ADS_ID'),
    )
    expect(adsConfig).toBeDefined()
    expect(adsConfig).not.toContain('send_page_view')
  })

  it('consent bootstrap is installed BEFORE the gtag scripts in the layout (ad_storage gates the Ads tag)', () => {
    const src = layout()
    const bootstrapIdx = src.indexOf('sf-consent-bootstrap')
    const adsIdx = src.indexOf('NEXT_PUBLIC_GOOGLE_ADS_ID')
    expect(bootstrapIdx).toBeGreaterThanOrEqual(0)
    expect(adsIdx).toBeGreaterThanOrEqual(0)
    expect(bootstrapIdx).toBeLessThan(adsIdx)
  })

  it('declined consent: ad_storage lands denied in dataLayer before any AW config command', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        analytics: false,
        marketing: false,
        givenAt: '2026-06-12T00:00:00.000Z',
        source: 'banner_decline_all',
      }),
    )
    // 1. beforeInteractive bootstrap.
    runBootstrap()
    // 2. Simulated layout gtag-init: an AW config enters the same command
    //    queue (lazyOnload, so always after the bootstrap).
    const w = window as TestWindow & { gtag?: (...args: unknown[]) => void }
    w.gtag =
      w.gtag ||
      function gtag() {
        // eslint-disable-next-line prefer-rest-params
        ;(w.dataLayer as unknown[]).push(arguments)
      }
    w.gtag('config', 'AW-0000000000')

    const dl = (w.dataLayer ?? []) as ArrayLike<unknown>[]
    const flat = dl.map((e) => Array.from(e as ArrayLike<unknown>))
    const consentIdx = flat.findIndex(
      (e) => e[0] === 'consent' && e[1] === 'default',
    )
    const awIdx = flat.findIndex(
      (e) => e[0] === 'config' && e[1] === 'AW-0000000000',
    )
    expect(consentIdx).toBeGreaterThanOrEqual(0)
    expect(awIdx).toBeGreaterThanOrEqual(0)
    expect(consentIdx).toBeLessThan(awIdx)
    expect(
      (flat[consentIdx][2] as Record<string, unknown>).ad_storage,
    ).toBe('denied')
  })
})
