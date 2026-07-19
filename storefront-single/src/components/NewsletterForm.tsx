'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/strings';
import styles from './Footer.module.css';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function NewsletterForm() {
  const t = useTranslations('popup.newsletter');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');

    const fd = new FormData(e.currentTarget);
    const firstName = String(fd.get('firstName') || '').trim();
    const lastName = String(fd.get('lastName') || '').trim();
    const email = String(fd.get('email') || '').trim();

    try {
      const res = await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'newsletter_footer',
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
      e.currentTarget.reset();
    } catch {
      setStatus('error');
    }
  }

  return (
    <form className={styles.newsletter} onSubmit={handleSubmit}>
      <div className={styles.newsletterRow}>
        <input
          type="text"
          name="firstName"
          placeholder={t('firstNamePlaceholder')}
          aria-label={t('firstNameAria')}
          className={styles.newsletterInput}
        />
        <input
          type="text"
          name="lastName"
          placeholder={t('lastNamePlaceholder')}
          aria-label={t('lastNameAria')}
          className={styles.newsletterInput}
        />
      </div>
      <div className={styles.newsletterEmailRow}>
        <input
          type="email"
          name="email"
          placeholder={t('emailPlaceholder')}
          aria-label={t('emailAria')}
          required
          className={styles.newsletterInput}
        />
      </div>
      <button type="submit" className={styles.newsletterBtn} disabled={status === 'submitting'}>
        {status === 'submitting' ? t('submitting') : status === 'success' ? t('success') : t('submit')}
      </button>
      {status === 'error' && (
        <p className={styles.newsletterError}>{t('error')}</p>
      )}
    </form>
  );
}
