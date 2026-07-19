'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from '@/lib/strings';
import type { Review } from '@/data/reviews';
import { sortReviewsForTopic, summarizeReviews, topTopics } from '@/lib/reviews';
import ReviewSummary from './ReviewSummary';
import ReviewTopics from './ReviewTopics';
import ReviewGallery from './ReviewGallery';
import ReviewItem from './ReviewItem';
import ReviewForm from './ReviewForm';
import styles from './ReviewSection.module.css';

interface Props {
  // Server-composed: DB-approved reviews (pending/declined never reach this
  // prop) plus the curated/static corpus — see lib/reviews-store.ts:getMergedReviews.
  reviews: Review[];
  initialVisible?: number;
  summaryText?: string;
  // When set, lets the user submit a review for this product (POST /api/reviews).
  // Submissions are moderated — they never appear here until approved.
  productSlug?: string;
}

export default function ReviewSection({
  reviews,
  initialVisible = 5,
  summaryText,
  productSlug,
}: Props) {
  const t = useTranslations('reviews');

  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);
  const topics = useMemo(() => topTopics(reviews), [reviews]);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);
  const selectedTopic = topics.find((topic) => topic.key === selectedTopicKey) ?? null;
  const selectedTopicLabel = selectedTopic
    ? t.has(`topics.${selectedTopic.key}`)
      ? t(`topics.${selectedTopic.key}`)
      : selectedTopic.key
    : null;

  const sorted = useMemo(
    () => sortReviewsForTopic(reviews, selectedTopicKey),
    [reviews, selectedTopicKey],
  );

  const [visible, setVisible] = useState(initialVisible);
  const remaining = sorted.length - visible;

  function selectTopic(topicKey: string | null) {
    setSelectedTopicKey(topicKey);
    setVisible(initialVisible);
  }

  const hasAnyReviews = reviews.length > 0;

  return (
    <div className={styles.grid}>
      <div className={styles.left}>
        {hasAnyReviews && <ReviewSummary summary={summary} />}
      </div>

      <div className={styles.right}>
        {hasAnyReviews && (
          <>
            <ReviewTopics
              topics={topics}
              activeTopicKey={selectedTopicKey}
              summaryText={summaryText}
              onSelectTopic={selectTopic}
            />
            <ReviewGallery reviews={reviews} />
          </>
        )}

        <section className={styles.list} aria-label={t('listAria')}>
          {hasAnyReviews ? (
            <h3 className={styles.listTitle}>
              {selectedTopicLabel ? t('topicReviewsTitle', { topic: selectedTopicLabel }) : t('topReviewsTitle')}
            </h3>
          ) : (
            <h3 className={styles.listTitle}>{t('firstReviewTitle')}</h3>
          )}
          {selectedTopic && (
            <p className={styles.activeTopicNote}>
              {t('topicNote')}
            </p>
          )}
          {sorted.slice(0, visible).map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
          {remaining > 0 && (
            <div className={styles.moreWrap}>
              <button
                type="button"
                className={styles.moreBtn}
                onClick={() => setVisible((v) => v + 5)}
              >
                {t('viewMore', { count: remaining })}
              </button>
            </div>
          )}

          {productSlug && <ReviewForm productSlug={productSlug} />}
        </section>
      </div>
    </div>
  );
}
