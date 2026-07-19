'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@/lib/strings';
import type { Review } from '@/data/reviews';
import styles from './ReviewGallery.module.css';

interface Props {
  reviews: Review[];
  limit?: number;
}

interface GalleryPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  reviewId: string;
}

export default function ReviewGallery({ reviews, limit = 12 }: Props) {
  const t = useTranslations('reviews');
  const photos = useMemo<GalleryPhoto[]>(() => {
    const out: GalleryPhoto[] = [];
    for (const r of reviews) {
      if (!r.photos) continue;
      for (const p of r.photos) {
        out.push({ ...p, reviewId: r.id });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }, [reviews, limit]);

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const close = useCallback(() => setOpenIdx(null), []);
  const next = useCallback(
    () => setOpenIdx((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length],
  );
  const prev = useCallback(
    () => setOpenIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIdx, close, next, prev]);

  if (photos.length === 0) return null;
  const current = openIdx !== null ? photos[openIdx] : null;

  return (
    <section className={styles.section} aria-label={t('galleryAria')}>
      <h3 className={styles.title}>{t('galleryTitle')}</h3>
      <ul className={styles.strip}>
        {photos.map((p, i) => (
          <li key={`${p.reviewId}-${i}`}>
            <button
              type="button"
              className={styles.thumbBtn}
              onClick={() => setOpenIdx(i)}
              aria-label={t('openImage', { index: i + 1, total: photos.length })}
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={p.width}
                height={p.height}
                sizes="120px"
                className={styles.thumb}
              />
            </button>
          </li>
        ))}
      </ul>

      {current && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" onClick={close}>
          <button
            type="button"
            className={styles.lbClose}
            onClick={close}
            aria-label={t('closeLightbox')}
          >
            ×
          </button>
          <button
            type="button"
            className={`${styles.lbNav} ${styles.lbNavPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label={t('previousImage')}
          >
            ‹
          </button>
          <div className={styles.lbStage} onClick={(e) => e.stopPropagation()}>
            <Image
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="90vw"
              className={styles.lbImage}
              priority
            />
          </div>
          <button
            type="button"
            className={`${styles.lbNav} ${styles.lbNavNext}`}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t('nextImage')}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
