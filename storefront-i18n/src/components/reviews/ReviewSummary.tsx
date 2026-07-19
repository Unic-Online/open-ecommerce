'use client';

import { useTranslations } from 'next-intl';
import type { ReviewSummary as ReviewSummaryData } from '@/lib/reviews';
import { OPEN_REVIEW_FORM_EVENT } from '@/lib/user-reviews';
import styles from './ReviewSummary.module.css';

function openReviewForm() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_REVIEW_FORM_EVENT));
}

interface Props {
  summary: ReviewSummaryData;
}

const STAR_KEYS = [5, 4, 3, 2, 1] as const;

export default function ReviewSummary({ summary }: Props) {
  const t = useTranslations('reviews');
  const { average, total, breakdown } = summary;
  const avgRounded = Math.round(average * 10) / 10;
  return (
    <aside className={styles.panel} aria-label={t('summaryAria')}>
      <h3 className={styles.title}>{t('summaryTitle')}</h3>
      <div className={styles.average}>
        <Stars value={average} size="lg" />
        <span className={styles.averageText}>{t('averageOf5', { value: avgRounded.toFixed(1) })}</span>
      </div>
      <p className={styles.totalText}>{t('totalReviews', { count: total })}</p>
      <ul className={styles.bars}>
        {STAR_KEYS.map((star) => {
          const pct = Math.round(breakdown[star].ratio * 100);
          return (
            <li key={star} className={styles.barRow}>
              <span className={styles.barLabel}>{t('starsLine', { star })}</span>
              <span className={styles.barTrack}>
                <span
                  className={styles.barFill}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className={styles.barPct}>{pct}%</span>
            </li>
          );
        })}
      </ul>
      <div className={styles.cta}>
        <p className={styles.ctaTitle}>{t('ctaWriteIntro')}</p>
        <button
          type="button"
          className={styles.ctaButton}
          aria-label={t('writeReviewAria')}
          onClick={openReviewForm}
        >
          {t('writeReview')}
        </button>
      </div>
    </aside>
  );
}

export function Stars({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('reviews');
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={`${styles.starWrap} ${styles[`starWrap-${size}`]}`}
      role="img"
      aria-label={t('starsAriaValue', { value: value.toFixed(1) })}
    >
      <span className={styles.starsBg} aria-hidden="true">★★★★★</span>
      <span className={styles.starsFg} aria-hidden="true" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}
