'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import {
  CONSENT_CHANGED_EVENT,
  readConsent,
  writeConsent,
  type ConsentSource,
} from '@/lib/consent'
import styles from './CookieBanner.module.css'

export const OPEN_CONSENT_EVENT = 'sf:open-consent'

type Mode = 'hidden' | 'compact' | 'customize'

async function reportToServer(state: ReturnType<typeof writeConsent>) {
  try {
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analytics: state.analytics,
        marketing: state.marketing,
        source: state.source,
        givenAt: state.givenAt,
        version: state.version,
      }),
    })
  } catch {
    // Audit trail is best-effort; localStorage already holds the durable choice.
  }
}

// Stored consent is an external store: writeConsent dispatches
// CONSENT_CHANGED_EVENT, and the snapshot is a primitive so it stays
// referentially stable. The server snapshot claims a stored choice so the
// banner only appears after hydration (same as the old effect-based show).
function subscribeToConsentChanges(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange)
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange)
}
function getHasStoredChoiceSnapshot(): boolean {
  return readConsent() !== null
}
function getHasStoredChoiceServerSnapshot(): boolean {
  return true
}

export default function CookieBanner() {
  const t = useTranslations('common.cookies')
  const hasStoredChoice = useSyncExternalStore(
    subscribeToConsentChanges,
    getHasStoredChoiceSnapshot,
    getHasStoredChoiceServerSnapshot,
  )
  // Show on first visit (no stored choice); user interactions override.
  const [modeOverride, setModeOverride] = useState<Mode | null>(null)
  const mode: Mode = modeOverride ?? (hasStoredChoice ? 'hidden' : 'compact')
  const [analytics, setAnalytics] = useState(true)
  const [marketing, setMarketing] = useState(true)

  useEffect(() => {
    const onOpen = () => {
      const current = readConsent()
      if (current) {
        setAnalytics(current.analytics)
        setMarketing(current.marketing)
      }
      setModeOverride('customize')
    }
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen)
  }, [])

  const persist = useCallback(
    (input: { analytics: boolean; marketing: boolean; source: ConsentSource }) => {
      const state = writeConsent(input)
      reportToServer(state)
      setModeOverride('hidden')
    },
    []
  )

  const acceptAll = useCallback(
    () => persist({ analytics: true, marketing: true, source: 'banner_accept_all' }),
    [persist]
  )
  const declineAll = useCallback(
    () => persist({ analytics: false, marketing: false, source: 'banner_decline_all' }),
    [persist]
  )
  const saveCustom = useCallback(
    () =>
      persist({
        analytics,
        marketing,
        source: 'banner_customize',
      }),
    [persist, analytics, marketing]
  )

  if (mode === 'hidden') return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      className={styles.wrap}
    >
      <div className={styles.panel}>
        {mode === 'compact' ? (
          <>
            <div className={styles.body}>
              <h2 id="cookie-banner-title" className={styles.title}>
                {t('title')}
              </h2>
              <p className={styles.text}>
                {t('intro')}
              </p>
            </div>
            <div className={styles.actions}>
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={declineAll}
                >
                  {t('declineAll')}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => setModeOverride('customize')}
                >
                  {t('customize')}
                </button>
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={acceptAll}
              >
                {t('acceptAll')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.body}>
              <h2 id="cookie-banner-title" className={styles.title}>
                {t('customizeTitle')}
              </h2>
              <p className={styles.text}>
                {t('customizeIntro')}
                <em> {t('customizeIntroLink')} </em>
                {t('customizeIntroSuffix')}
              </p>
              <ul className={styles.toggleList}>
                <li className={styles.toggleItem}>
                  <div className={styles.toggleHead}>
                    <span className={styles.toggleName}>{t('necessary')}</span>
                    <span className={styles.alwaysOn}>{t('alwaysOn')}</span>
                  </div>
                  <p className={styles.toggleDesc}>
                    {t('necessaryDesc')}
                  </p>
                </li>
                <li className={styles.toggleItem}>
                  <label className={styles.toggleHead}>
                    <span className={styles.toggleName}>{t('analytics')}</span>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                    />
                  </label>
                  <p className={styles.toggleDesc}>
                    {t('analyticsDesc')}
                  </p>
                </li>
                <li className={styles.toggleItem}>
                  <label className={styles.toggleHead}>
                    <span className={styles.toggleName}>{t('marketing')}</span>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                    />
                  </label>
                  <p className={styles.toggleDesc}>
                    {t('marketingDesc')}
                  </p>
                </li>
              </ul>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={declineAll}
              >
                {t('declineAll')}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveCustom}
              >
                {t('savePreferences')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Footer-link helper — emits the open event from anywhere in the app. */
export function openCookieSettings() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))
}

/** Re-export so the consumer can listen for changes. */
export { CONSENT_CHANGED_EVENT }
