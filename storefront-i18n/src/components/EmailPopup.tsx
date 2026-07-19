'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getStoredEmail, storeEmail, isPopupDismissed, dismissPopup, isValidEmail } from '@/lib/email-capture';
import { trackEvent } from '@/lib/analytics';
import { WELCOME_DISCOUNT_PERCENT } from '@/lib/pricing';
import styles from './EmailPopup.module.css';

interface EmailPopupProps {
  /** Delay in ms before showing the popup (default 15000 = 15 seconds) */
  delay?: number;
}

export default function EmailPopup({ delay = 15000 }: EmailPopupProps) {
  const t = useTranslations('popup.email');
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Don't show if: email already stored, popup dismissed, or SSR
    if (typeof window === 'undefined') return;
    if (getStoredEmail() || isPopupDismissed()) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const handleClose = useCallback(() => {
    setVisible(false);
    dismissPopup();
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError(t('errorInvalidEmail'));
      return;
    }

    storeEmail(email);
    setSubmitted(true);

    // Save to MongoDB + Resend contacts
    fetch('/api/capture-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), source: 'email_popup_welcome_offer' }),
    }).catch(() => {});

    // Fire Lead event to Meta
    trackEvent('Lead', {
      content_name: 'Email Popup — Welcome Offer',
      content_category: 'Pietre Luminescente',
    }, {
      email: email.trim().toLowerCase(),
    });

    // Auto hide after 3 seconds
    setTimeout(() => {
      setVisible(false);
      dismissPopup();
    }, 3000);
  }, [email, t]);

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.popup} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label={t('close')}>✕</button>

        {!submitted ? (
          <>
            <div className={styles.badge}>{t('badge')}</div>
            <h2 className={styles.title}>
              <span className={styles.discount}>{t('title', { percent: WELCOME_DISCOUNT_PERCENT })}</span>
              <br />
              {t('subtitleAfter')}
            </h2>
            <p className={styles.subtitle}>
              {t.rich('subtitle', {
                percent: WELCOME_DISCOUNT_PERCENT,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                type="email"
                className={styles.input}
                placeholder={t('placeholder')}
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoFocus
              />
              {error && <span className={styles.error}>{error}</span>}
              <button type="submit" className={styles.submitBtn}>
                {t('submit', { percent: WELCOME_DISCOUNT_PERCENT })}
              </button>
            </form>

            <p className={styles.hint}>
              {t('hint')}
            </p>
          </>
        ) : (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.title}>{t('successTitle')}</h2>
            <p className={styles.subtitle}>
              {t('successSubtitle')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
