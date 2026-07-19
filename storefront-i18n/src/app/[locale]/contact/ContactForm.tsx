'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './Contact.module.css';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactForm() {
  const t = useTranslations('common.contact.form');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: String(formData.get('firstName') || '').trim(),
      lastName: String(formData.get('lastName') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      subject: String(formData.get('subject') || '').trim(),
      message: String(formData.get('message') || '').trim(),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error || t('errorGeneric'));
        setStatus('error');
        return;
      }

      setStatus('success');
      e.currentTarget.reset();
    } catch (err) {
      console.error('Contact form error:', err);
      setErrorMsg(t('errorNetwork'));
      setStatus('error');
    }
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
      <p className={styles.formIntro}>{t('intro')}</p>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="firstName" className={styles.label}>{t('firstName')}</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            placeholder={t('firstNamePlaceholder')}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="lastName" className={styles.label}>{t('lastName')}</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            placeholder={t('lastNamePlaceholder')}
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>{t('email')}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="phone" className={styles.label}>{t('phone')}</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.row} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.field}>
          <label htmlFor="subject" className={styles.label}>{t('subject')}</label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            placeholder={t('subjectPlaceholder')}
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="message" className={styles.label}>{t('message')}</label>
        <textarea
          id="message"
          name="message"
          required
          placeholder={t('messagePlaceholder')}
          className={styles.textarea}
        />
      </div>

      <button type="submit" className={styles.submit} disabled={status === 'submitting'}>
        {status === 'submitting' ? t('submitting') : t('submit')}
      </button>

      {status === 'success' && (
        <div className={styles.success} role="status">
          {t('success')}
        </div>
      )}
      {status === 'error' && (
        <div className={styles.error} role="alert">
          {errorMsg}
        </div>
      )}
    </form>
  );
}
