'use client';

import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from '@/lib/strings';
import type { Review } from '@/data/reviews';
import { formatReviewDate, reviewInitials } from '@/lib/reviews';
import { Stars } from './ReviewSummary';
import styles from './ReviewItem.module.css';

interface Props {
  review: Review;
  onPhotoClick?: (reviewId: string, photoIdx: number) => void;
}

const HELPFUL_STORAGE = 'sf_review_helpful';


// The stored "helpful" vote is a read-once external value: nothing else
// mutates it while the item is mounted (vote() below re-renders via state),
// so the subscription is a no-op and the snapshot is a stable primitive.
function subscribeToNothing() {
  return () => {};
}
function hasStoredHelpfulVote(reviewId: string): boolean {
  try {
    const raw = window.localStorage.getItem(HELPFUL_STORAGE);
    if (!raw) return false;
    return new Set<string>(JSON.parse(raw)).has(reviewId);
  } catch {
    return false;
  }
}

export default function ReviewItem({ review, onPhotoClick }: Props) {
  const t = useTranslations('reviews');
  const storedVote = useSyncExternalStore(
    subscribeToNothing,
    () => hasStoredHelpfulVote(review.id),
    () => false,
  );
  const [votedNow, setVotedNow] = useState(false);
  const [reported, setReported] = useState(false);
  const voted = storedVote || votedNow;
  const helpful = (review.helpfulCount ?? 0) + (voted ? 1 : 0);

  const vote = () => {
    if (voted) return;
    setVotedNow(true);
    try {
      const raw = window.localStorage.getItem(HELPFUL_STORAGE);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      if (!arr.includes(review.id)) arr.push(review.id);
      window.localStorage.setItem(HELPFUL_STORAGE, JSON.stringify(arr));
    } catch {
      /* ignore */
    }
  };

  const variantBits: string[] = [];
  if (review.variant?.color) variantBits.push(t('variantColor', { value: review.variant.color }));
  if (review.variant?.size) variantBits.push(t('variantSize', { value: review.variant.size }));
  if (review.variant?.quantity) variantBits.push(t('variantQuantity', { value: review.variant.quantity }));

  return (
    <article className={styles.item}>
      <header className={styles.header}>
        <div className={styles.avatar} aria-hidden="true">
          {reviewInitials(review.name)}
        </div>
        <div className={styles.identity}>
          <span className={styles.name}>{review.name}</span>
          <span className={styles.location}>{review.location}</span>
        </div>
      </header>

      <div className={styles.titleRow}>
        <Stars value={review.rating} size="sm" />
        <h4 className={styles.title}>{review.title}</h4>
      </div>

      <p className={styles.meta}>
        {t('reviewedInRomania', { date: formatReviewDate(review.date) })}
      </p>

      <p className={styles.variantLine}>
        {variantBits.length > 0 && <span>{variantBits.join(' · ')}</span>}
        {review.verifiedPurchase && (
          <span className={styles.verified}>
            <span aria-hidden="true">✓ </span>{t('verifiedPurchase')}
          </span>
        )}
      </p>

      <div className={styles.body}>
        {review.text.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {review.photos && review.photos.length > 0 && (
        <ul className={styles.photos}>
          {review.photos.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                className={styles.photoBtn}
                onClick={() => onPhotoClick?.(review.id, i)}
                aria-label={t('openReviewImage', { index: i + 1, name: review.name })}
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  width={p.width}
                  height={p.height}
                  sizes="120px"
                  className={styles.photo}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className={styles.footer}>
        {helpful > 0 && (
          <span className={styles.helpfulCount}>
            {t('helpfulCount', { count: helpful })}
          </span>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.helpfulBtn} ${voted ? styles.helpfulBtnVoted : ''}`}
            onClick={vote}
            disabled={voted}
            aria-pressed={voted}
          >
            {voted ? t('thankYou') : t('helpful')}
          </button>
          <span className={styles.divider} aria-hidden="true">|</span>
          {reported ? (
            <span className={styles.reportedNote} role="status">
              {t('reported')}
            </span>
          ) : (
            <button
              type="button"
              className={styles.reportBtn}
              onClick={() => setReported(true)}
            >
              {t('report')}
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
