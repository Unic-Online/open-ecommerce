import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  getBootstrapScript,
  hasMarketingConsent,
  hasAnalyticsConsent,
  readConsent,
  writeConsent,
} from '@/lib/consent'

beforeEach(() => {
  localStorage.clear()
  delete (window as Window & { __sfConsent?: unknown }).__sfConsent
})

describe('readConsent', () => {
  it('returns null when no entry exists (default-deny)', () => {
    expect(readConsent()).toBeNull()
  })

  it('returns parsed state when present and version matches', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        necessary: true,
        analytics: true,
        marketing: true,
        givenAt: '2026-05-01T00:00:00.000Z',
        source: 'banner_accept_all',
      })
    )
    const c = readConsent()
    expect(c?.marketing).toBe(true)
    expect(c?.analytics).toBe(true)
  })

  it('returns null when version mismatches (forces re-consent on policy update)', () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: '0',
        necessary: true,
        analytics: true,
        marketing: true,
        givenAt: '2024-01-01T00:00:00.000Z',
        source: 'banner_accept_all',
      })
    )
    expect(readConsent()).toBeNull()
  })

  it('returns null on malformed JSON without throwing', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, '{not-json')
    expect(readConsent()).toBeNull()
  })
})

describe('writeConsent', () => {
  it('persists to localStorage with current version and timestamp', () => {
    const before = Date.now()
    const state = writeConsent({ analytics: true, marketing: false, source: 'banner_customize' })
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) ?? 'null')

    expect(state.version).toBe(CONSENT_VERSION)
    expect(state.analytics).toBe(true)
    expect(state.marketing).toBe(false)
    expect(state.source).toBe('banner_customize')
    expect(new Date(state.givenAt).getTime()).toBeGreaterThanOrEqual(before)
    expect(stored).toEqual(state)
  })

  it('updates window.__sfConsent', () => {
    writeConsent({ analytics: false, marketing: true, source: 'banner_accept_all' })
    expect(window.__sfConsent?.marketing).toBe(true)
  })

  it('dispatches the change event with the new state', () => {
    const handler = vi.fn()
    window.addEventListener(CONSENT_CHANGED_EVENT, handler)

    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail
    expect(detail.marketing).toBe(true)
    expect(detail.analytics).toBe(true)

    window.removeEventListener(CONSENT_CHANGED_EVENT, handler)
  })
})

describe('hasMarketingConsent / hasAnalyticsConsent', () => {
  it('default-denies when no decision stored (GDPR baseline)', () => {
    expect(hasMarketingConsent()).toBe(false)
    expect(hasAnalyticsConsent()).toBe(false)
  })

  it('reflects window.__sfConsent when set by bootstrap', () => {
    window.__sfConsent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: false,
      givenAt: new Date().toISOString(),
      source: 'banner_customize',
    }
    expect(hasMarketingConsent()).toBe(false)
    expect(hasAnalyticsConsent()).toBe(true)
  })

  it('flips correctly after writeConsent', () => {
    writeConsent({ analytics: false, marketing: false, source: 'banner_decline_all' })
    expect(hasMarketingConsent()).toBe(false)

    writeConsent({ analytics: true, marketing: true, source: 'banner_accept_all' })
    expect(hasMarketingConsent()).toBe(true)
    expect(hasAnalyticsConsent()).toBe(true)
  })
})

describe('getBootstrapScript', () => {
  it('returns a self-contained IIFE that does not reference React/imports', () => {
    const src = getBootstrapScript()
    expect(src).toMatch(/^\(function\(\)/)
    expect(src).toContain(CONSENT_STORAGE_KEY)
    // Google Consent Mode v2 fields
    expect(src).toContain('ad_storage')
    expect(src).toContain('analytics_storage')
    expect(src).toContain('ad_user_data')
    expect(src).toContain('ad_personalization')
    // listens for our change event
    expect(src).toContain(CONSENT_CHANGED_EVENT)
    // no template variables leaked
    expect(src).not.toContain('${')
  })
})
