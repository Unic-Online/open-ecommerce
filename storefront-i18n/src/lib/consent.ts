/**
 * GDPR consent management for the storefront.
 *
 * Two consumers:
 *   - browser: read state from localStorage to gate Pixel/GA, emit
 *     `sf:consent-changed` CustomEvent on every save so listeners react
 *   - inline `beforeInteractive` bootstrap in layout.tsx: reads localStorage
 *     synchronously, sets window.__sfConsent + gtag('consent','default')
 *     before any tracker loads
 *
 * Default-deny: until the user explicitly clicks Accept (or chooses any
 * non-default toggle), analytics & marketing are OFF. This is the GDPR
 * baseline; the banner exists to upgrade away from this default.
 */

import { storage } from '@/site.config'

export const CONSENT_VERSION = '1'
export const CONSENT_STORAGE_KEY = `${storage.consentLocalStoragePrefix}v${CONSENT_VERSION}`
export const CONSENT_CHANGED_EVENT = 'sf:consent-changed'

export type ConsentSource = 'banner_accept_all' | 'banner_decline_all' | 'banner_customize' | 'footer_link'

export interface ConsentState {
  version: string
  necessary: true
  analytics: boolean
  marketing: boolean
  givenAt: string
  source: ConsentSource
}

export const DEFAULT_DENIED: Omit<ConsentState, 'givenAt' | 'source'> = {
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
}

declare global {
  interface Window {
    __sfConsent?: ConsentState | null
  }
}

export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentState
    if (parsed.version !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Marketing-tracking-allowed check. Used by analytics.ts and meta-capi.ts.
 *
 * Server-side (no window): returns false. Server callers receive consent
 * state explicitly via API request bodies; this is the browser default
 * fallback.
 */
export function hasMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false
  const c = window.__sfConsent ?? readConsent()
  return c?.marketing === true
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  const c = window.__sfConsent ?? readConsent()
  return c?.analytics === true
}

export function writeConsent(input: {
  analytics: boolean
  marketing: boolean
  source: ConsentSource
}): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: input.analytics,
    marketing: input.marketing,
    givenAt: new Date().toISOString(),
    source: input.source,
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage may be disabled (incognito Safari with strict mode etc.)
      // The Pixel/GA gating still works against window.__sfConsent below.
    }
    window.__sfConsent = state
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }))
  }
  return state
}

/**
 * Inline bootstrap source: serialized into a `<script>` tag in layout.tsx
 * with `strategy="beforeInteractive"` so it runs before fbevents.js or
 * gtag.js. Sets window.__sfConsent + Google Consent Mode v2 defaults.
 * Keep this string pure — no external imports, no template literal eval.
 */
export function getBootstrapScript(): string {
  return `
(function() {
  var KEY = '${CONSENT_STORAGE_KEY}';
  var VER = '${CONSENT_VERSION}';
  var c = null;
  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && p.version === VER) c = p;
    }
  } catch (e) {}
  window.__sfConsent = c;

  // Google Consent Mode v2 — populate dataLayer BEFORE gtag.js loads so
  // every hit respects the choice. The 'default' command applies to all
  // events fired before the user makes a choice; 'update' applies once
  // the user clicks Accept/Decline (dispatched via sf:consent-changed).
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function applyConsent(state, command) {
    var analyticsState = (state && state.analytics) ? 'granted' : 'denied';
    var marketingState = (state && state.marketing) ? 'granted' : 'denied';
    var args = {
      ad_storage: marketingState,
      ad_user_data: marketingState,
      ad_personalization: marketingState,
      analytics_storage: analyticsState
    };
    if (command === 'default') args.wait_for_update = 500;
    gtag('consent', command, args);
  }

  applyConsent(c, 'default');

  // The CookieBanner emits this event on every Accept/Decline/Save click.
  // Listener persists across client-side navigations because the layout
  // root element is never unmounted in App Router SPA navigation.
  window.addEventListener('${CONSENT_CHANGED_EVENT}', function(e) {
    applyConsent(e.detail, 'update');
  });
})();
`.trim()
}
