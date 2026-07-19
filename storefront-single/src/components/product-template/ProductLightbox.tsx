'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from '@/lib/strings';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel';
import type { ProductGalleryImage } from '@/lib/product';
import styles from './product.module.css';

interface Props {
  images: ProductGalleryImage[];
  startIndex: number;
  onClose: () => void;
}

export default function ProductLightbox({ images, startIndex, onClose }: Props) {
  const t = useTranslations('product.gallery');
  const [activeIndex, setActiveIndex] = useState(startIndex);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    startIndex,
    align: 'center',
  });

  const onSelect = useCallback(
    (api: EmblaCarouselType) => {
      setActiveIndex(api.selectedScrollSnap());
    },
    [],
  );

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (i: number) => {
      if (emblaApi) emblaApi.scrollTo(i);
    },
    [emblaApi],
  );

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && emblaApi) emblaApi.scrollNext();
      else if (e.key === 'ArrowLeft' && emblaApi) emblaApi.scrollPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [emblaApi, onClose]);

  return (
    <div
      className={styles.lightboxBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightboxAria')}
    >
      {/* Close button */}
      <button
        type="button"
        className={styles.lightboxCloseBtn}
        onClick={onClose}
        aria-label={t('lightboxClose')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Nav arrows (desktop) */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
            onClick={() => emblaApi?.scrollPrev()}
            aria-label={t('lightboxPrev')}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
            onClick={() => emblaApi?.scrollNext()}
            aria-label={t('lightboxNext')}
          >
            ›
          </button>
        </>
      )}

      {/* Main image carousel */}
      <div className={styles.lightboxEmbla} ref={emblaRef}>
        <div className={styles.lightboxContainer}>
          {images.map((img, i) => (
            <div key={i} className={styles.lightboxSlide}>
              <Image
                src={img.src}
                alt={img.label}
                width={1400}
                height={1400}
                className={styles.lightboxImage}
                priority={Math.abs(i - startIndex) <= 1}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom thumbnail strip */}
      {images.length > 1 && (
        <div className={styles.lightboxThumbs}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.lightboxThumb} ${i === activeIndex ? styles.lightboxThumbActive : ''}`}
              onClick={() => scrollTo(i)}
              aria-label={t('thumbAria', { n: i + 1, label: img.label })}
            >
              <Image
                src={img.src}
                alt={img.label}
                width={64}
                height={64}
                className={styles.lightboxThumbImg}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
