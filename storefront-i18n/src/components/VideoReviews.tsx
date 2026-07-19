'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './VideoReviews.module.css';

interface VideoReview {
  id: string;
  /** Local (`public/videos/*`) or CDN mp4. For a hosted embed (Vimeo,
   *  YouTube), swap the `<video>` below back to an `<iframe>` on the
   *  player URL. */
  src: string;
}

// Generic demo clips rendered from the catalog imagery — replace with your
// real customer videos.
const REVIEWS: VideoReview[] = [
  { id: 'clip-1', src: '/videos/review-1.mp4' },
  { id: 'clip-2', src: '/videos/review-2.mp4' },
  { id: 'clip-3', src: '/videos/review-3.mp4' },
  { id: 'clip-4', src: '/videos/review-4.mp4' },
];

interface VideoCardProps {
  review: VideoReview;
}

function VideoCard({ review }: VideoCardProps) {
  const t = useTranslations('reviews.video');
  const [loaded, setLoaded] = useState(false);
  const reviewerName = t('verifiedClient');

  return (
    <div className={styles.card}>
      <div className={styles.videoWrap}>
        {!loaded && (
          <button
            type="button"
            className={styles.placeholder}
            onClick={() => setLoaded(true)}
            aria-label={t('playReviewByName', { name: reviewerName })}
          >
            <div className={styles.placeholderGlow} />
            <div className={styles.playBtn}>
              <div className={styles.playTriangle} />
            </div>
          </button>
        )}
        {loaded && (
          <video
            src={review.src}
            className={styles.iframe}
            autoPlay
            controls
            playsInline
            loop
            title={t('iframeTitle', { name: reviewerName })}
          />
        )}
      </div>
      <div className={styles.cardInfo}>
        <span className={styles.verifiedBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {reviewerName}
        </span>
      </div>
    </div>
  );
}

export default function VideoReviews() {
  const t = useTranslations('reviews.video');
  return (
    <section className={styles.section} id="video-reviews">
      <div className={styles.inner}>
        <span className={styles.eyebrow}>{t('eyebrow')}</span>
        <h2 className={styles.title}>{t('title')}</h2>
        <p className={styles.subtitle}>{t('subtitle')}</p>
        <div className={styles.grid}>
          {REVIEWS.map((review) => (
            <VideoCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}
