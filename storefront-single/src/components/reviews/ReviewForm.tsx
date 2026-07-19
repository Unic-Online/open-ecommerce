'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from '@/lib/strings';
import { OPEN_REVIEW_FORM_EVENT } from '@/lib/user-reviews';
import styles from './ReviewForm.module.css';

interface Props {
  productSlug: string;
}

export default function ReviewForm({ productSlug }: Props) {
  const t = useTranslations('reviews.form');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot — a real visitor never fills this
  const [error, setError] = useState('');
  const [reviewToken, setReviewToken] = useState<string | null>(null);

  // Listen for "open the review form" requests from anywhere on the
  // page (e.g. the ReviewSummary CTA). Auto-scroll into view so the
  // user lands on the form even if they clicked from far above.
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setSubmitted(false);
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };
    window.addEventListener(OPEN_REVIEW_FORM_EVENT, handler);
    return () => window.removeEventListener(OPEN_REVIEW_FORM_EVENT, handler);
  }, []);

  // A review-request email CTA carries `?rt=<signed token>` — proof this
  // visitor actually bought the product, checked server-side in /api/reviews.
  // Auto-open the form so the whole point of the email link (get a review)
  // doesn't require an extra click.
  useEffect(() => {
    const rt = new URLSearchParams(window.location.search).get('rt');
    if (!rt) return;
    setReviewToken(rt);
    setOpen(true);
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  function reset() {
    setName('');
    setRating(5);
    setTitle('');
    setText('');
    setEmail('');
    setCompany('');
    setSubmitted(false);
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError(t('errorName'));
      return;
    }
    if (text.trim().length < 10) {
      setError(t('errorComment'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: productSlug,
          name: name.trim(),
          rating,
          title: title.trim() || undefined,
          text: text.trim(),
          email: email.trim() || undefined,
          rt: reviewToken ?? undefined,
          company,
        }),
      });
      if (!res.ok) {
        setError(t('errorSubmit'));
        return;
      }
      setSubmitted(true);
    } catch {
      setError(t('errorSubmit'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div ref={containerRef}>
        <button
          type="button"
          className={styles.openBtn}
          onClick={() => setOpen(true)}
        >
          {t('openCta')}
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div ref={containerRef} className={styles.success} role="status" aria-live="polite">
        <div className={styles.successIcon}>✓</div>
        <h3>{t('successTitle')}</h3>
        <button
          type="button"
          className={styles.openBtn}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          {t('close')}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.title}>{t('title')}</h3>

        <div className={styles.field}>
          <label htmlFor="review-name">{t('yourName')}</label>
          <input
            id="review-name"
            type="text"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <fieldset className={styles.field}>
          <legend>{t('ratingLegend')}</legend>
          <div className={styles.stars} role="radiogroup" aria-label={t('ratingAria')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t('starsCount', { count: n })}
                className={`${styles.star} ${n <= rating ? styles.starActive : ''}`}
                onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
              >
                ★
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="review-title">{t('titleField')}</label>
          <input
            id="review-title"
            type="text"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="review-text">{t('comment')}</label>
          <textarea
            id="review-text"
            minLength={10}
            maxLength={2000}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            placeholder={t('commentPlaceholder')}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="review-email">{t('emailField')}</label>
          <input
            id="review-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
          />
        </div>

        {/* Honeypot: hidden from real visitors via CSS, never via `type="hidden"`
            (some bots skip that but still fill visually-hidden text inputs). */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="review-company">Company</label>
          <input
            id="review-company"
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            {t('cancel')}
          </button>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
