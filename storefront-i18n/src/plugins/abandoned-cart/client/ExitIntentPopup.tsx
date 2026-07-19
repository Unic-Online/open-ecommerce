'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import {
  getStoredEmail,
  isValidEmail,
  storeEmail,
} from '@/lib/email-capture';
import { trackEvent } from '@/lib/analytics';
import { useCart } from '@/lib/cart-context';
import { WELCOME_DISCOUNT_PERCENT } from '@/lib/pricing';
import {
  abandonedCartConfig,
  EXIT_INTENT_COOLDOWN_MS,
  EXIT_INTENT_SKIP_PATHS,
} from '../config';
import {
  installExitIntentDetector,
  snoozeExitIntentForCooldown,
} from './exit-intent-detector';
import styles from './ExitIntentPopup.module.css';

export default function ExitIntentPopup() {
  const t = useTranslations('popup.exitIntent');
  const pathname = usePathname();
  const { items } = useCart();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // The detector is installed once per pathname change. Cart presence is
  // checked via a ref so listeners (attached once) always read the latest
  // value without being torn down on every items-array reference change.
  const cartHasItemsRef = useRef(false);
  useEffect(() => {
    cartHasItemsRef.current = items.length > 0;
  }, [items]);

  const skipPath = EXIT_INTENT_SKIP_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (skipPath) return;
    return installExitIntentDetector({
      // Skip when cart is empty, or when the user already gave us their
      // email earlier (the welcome popup, an order, etc.) — re-asking
      // would be both annoying and a worse offer than what they have.
      shouldShow: () => cartHasItemsRef.current && !getStoredEmail(),
      cooldownMs: EXIT_INTENT_COOLDOWN_MS,
      onTrigger: () => setVisible(true),
      backIntercept: abandonedCartConfig.exitIntentBackIntercept,
    });
  }, [skipPath, pathname]);

  // Body scroll lock while the popup is visible (parity with EmailPopup).
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    setVisible(false);
    // Soft dismissal: respect the existing 1h cooldown but allow the popup to
    // come back later (e.g. after returning from /checkout).
    snoozeExitIntentForCooldown();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (!isValidEmail(email)) {
        setError(t('errorInvalidEmail'));
        return;
      }
      const normalized = email.trim().toLowerCase();
      storeEmail(normalized);
      setSubmitted(true);

      fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalized,
          source: 'exit_intent_popup',
        }),
      }).catch(() => {});

      // trackEvent self-gates on marketing consent — no-ops if denied.
      trackEvent(
        'Lead',
        {
          content_name: 'Exit Intent — 10% Discount',
          content_category: 'Pietre Luminescente',
        },
        { email: normalized },
      );

      setTimeout(() => {
        setVisible(false);
      }, 2500);
    },
    [email, t],
  );

  if (skipPath || !visible) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <aside
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label={t('close')}
        >
          ✕
        </button>

        {!submitted ? (
          <>
            <span className={styles.badge}>
              {t('badge', { percent: WELCOME_DISCOUNT_PERCENT })}
            </span>
            <h2 id="exit-intent-title" className={styles.title}>
              {t('title')}
            </h2>
            <p className={styles.copy}>
              {t.rich('copyPrimary', {
                percent: WELCOME_DISCOUNT_PERCENT,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className={styles.copy}>
              {t('copySecondary')}
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                type="email"
                className={styles.input}
                placeholder={t('placeholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                // Why: on touch devices autofocus slams the keyboard open over
                // the popup the instant it appears — fine-pointer only.
                autoFocus={
                  typeof window !== 'undefined' &&
                  typeof window.matchMedia === 'function' &&
                  window.matchMedia('(pointer: fine)').matches
                }
              />
              {error && <span className={styles.error}>{error}</span>}
              <button type="submit" className={styles.submitBtn}>
                {t('submit')}
              </button>
            </form>
          </>
        ) : (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.title}>{t('successTitle')}</h2>
            <p className={styles.copy}>
              {t('successCopy', { percent: WELCOME_DISCOUNT_PERCENT })}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
