/**
 * Shared GDPR-consent test helpers.
 *
 * Production code reads `window.__sfConsent` (set by the beforeInteractive
 * bootstrap in layout.tsx; Window typing lives in `@/lib/consent`). Tests
 * previously hand-assigned the global with ad-hoc shapes; use these so the
 * shape stays in sync with `ConsentState` in one place.
 *
 * Usage:
 *   setWindowConsent({ marketing: true });   // analytics defaults true
 *   ...
 *   clearWindowConsent();                    // afterEach if the file toggles
 *                                            // consent per test
 */
import { CONSENT_VERSION, type ConsentState } from '@/lib/consent';

export function setWindowConsent(
  overrides: Partial<Pick<ConsentState, 'analytics' | 'marketing' | 'source'>> = {},
): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: true,
    marketing: true,
    givenAt: new Date().toISOString(),
    source: 'banner_accept_all',
    ...overrides,
  };
  window.__sfConsent = state;
  return state;
}

export function clearWindowConsent(): void {
  delete window.__sfConsent;
}
