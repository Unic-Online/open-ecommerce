'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel';
import type { ProductGalleryImage, ProductSpec } from '@/lib/product';
import ProductLightbox from './ProductLightbox';
import { logProductEvent } from '@/lib/observability';
import styles from './product.module.css';

interface Props {
  images: ProductGalleryImage[];
  slug: string;
  weightSpec?: ProductSpec | null;
}

export default function ProductGallery({ images, slug, weightSpec }: Props) {
  const t = useTranslations('product.gallery');
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });

  const onSelect = useCallback((api: EmblaCarouselType) => {
    setActiveIndex(api.selectedScrollSnap());
  }, []);

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
      setActiveIndex(i);
    },
    [emblaApi],
  );

  const openLightbox = useCallback(
    (i: number) => {
      setLightboxIndex(i);
      setLightboxOpen(true);
      logProductEvent('gallery_lightbox_open', { slug, index: String(i) });
    },
    [slug],
  );

  return (
    <>
      <div className={styles.gallery}>
        <ul className={styles.thumbs}>
          {images.map((img, i) => (
            <li key={i}>
              <button
                type="button"
                className={`${styles.thumbBtn} ${i === activeIndex ? styles.thumbBtnActive : ''}`}
                onClick={() => scrollTo(i)}
                aria-label={t('thumbAria', { n: i + 1, label: img.label })}
              >
                <Image
                  src={img.src}
                  alt={img.label}
                  width={72}
                  height={72}
                  className={styles.thumbImg}
                />
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.galleryViewport}>
          <div className={styles.embla} ref={emblaRef}>
            <div className={styles.emblaContainer}>
              {images.map((img, i) => (
                <div key={i} className={styles.emblaSlide}>
                  <button
                    type="button"
                    className={styles.galleryMainBtn}
                    onClick={() => openLightbox(i)}
                    aria-label={t('expandAria', { n: i + 1 })}
                  >
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
                      <Image
                        src={img.src}
                        alt={img.label}
                        fill
                        sizes="(max-width: 768px) 100vw, 720px"
                        className={styles.emblaSlideImg}
                        priority={i === 0}
                      />
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.emblaDots}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.emblaDot} ${i === activeIndex ? styles.emblaDotActive : ''}`}
                onClick={() => scrollTo(i)}
                aria-label={t('dotAria', { n: i + 1 })}
              />
            ))}
          </div>

          {weightSpec && (
            <div className={styles.galleryWeight}>
              <span className={styles.galleryWeightLabel}>{weightSpec.label}</span>
              <span className={styles.galleryWeightValue}>{weightSpec.value}</span>
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <ProductLightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
