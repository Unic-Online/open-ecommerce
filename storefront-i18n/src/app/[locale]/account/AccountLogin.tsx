'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import styles from './account.module.css';

interface Props {
  initialError?: string;
}

export default function AccountLogin({ initialError }: Props) {
  const t = useTranslations('account.login');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>(initialError ? t('errorInvalidLink') : '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError(t('errorRateLimited'));
        return;
      }
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.loginCard}>
        <div className={styles.loginSuccess}>{t('linkSent')}</div>
        <p className={styles.loginHint}>{t('linkSentHint')}</p>
      </div>
    );
  }

  return (
    <form className={styles.loginCard} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.profileName} style={{ marginBottom: '1.25rem' }}>
        {t('title')}
      </h2>
      {error && <div className={styles.loginError}>{error}</div>}
      <label htmlFor="account-email" className={styles.loginLabel}>
        {t('emailLabel')}
      </label>
      <input
        id="account-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('emailPlaceholder')}
        className={styles.loginInput}
      />
      <button type="submit" className={styles.loginBtn} disabled={submitting}>
        {submitting ? t('sending') : t('submit')}
      </button>
      <p className={styles.loginHint}>{t('hint')}</p>
    </form>
  );
}
