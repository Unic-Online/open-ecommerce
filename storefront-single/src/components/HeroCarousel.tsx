'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from '@/lib/strings'
import { Link } from '@/lib/nav'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import styles from './HeroCarousel.module.css'

interface SlideMeta {
  image: string
  href?: string
}

interface SlideCopy {
  alt: string
  label: string
  sublabel: string
  cta: string
}

// Image paths and links are NOT translation strings — they are the same
// across locales. The localized alt/label/sublabel/cta come from messages
// via `home.hero.slides[idx]` and are zipped with this array by index.
// Slide 0 is the sale hero (no link); the rest reuse demo product imagery
// and link to their category.
const SLIDE_META: SlideMeta[] = [
  { image: '/images/oslo-nightstand/3.jpg' },
  { image: '/images/halo-table-lamp/3.jpg', href: '/lighting' },
  { image: '/images/terra-path-light/3.jpg', href: '/outdoor' },
  { image: '/images/aria-console/3.jpg', href: '/furniture' },
]

export default function HeroCarousel() {
  const t = useTranslations('home.hero')
  const slidesCopy = t.raw('slides') as SlideCopy[]

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      skipSnaps: false,
      dragFree: false,
    },
    [
      Autoplay({
        delay: 5000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        playOnInit: true,
      }),
    ],
  )

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  const scrollTo = useCallback(
    (index: number) => {
      if (!emblaApi) return
      emblaApi.scrollTo(index)
    },
    [emblaApi],
  )

  useEffect(() => {
    if (!emblaApi) return
    setScrollSnaps(emblaApi.scrollSnapList())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  return (
    <section className={styles.heroSection}>
      <div className={styles.embla}>
        <div className={styles.emblaViewport} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {SLIDE_META.map((meta, idx) => {
              const copy = slidesCopy[idx]
              return (
                <div key={idx} className={styles.emblaSlide}>
                  <Image
                    src={meta.image}
                    alt={copy.alt}
                    fill
                    sizes="(max-width: 1023px) 100vw, 600px"
                    className={styles.slideImage}
                    priority={idx === 0}
                    fetchPriority={idx === 0 ? 'high' : undefined}
                  />
                  <div className={styles.slideOverlay} />

                  {idx === 0 ? (
                    /* ---- First slide: full sale hero ---- */
                    <div className={styles.slideContent}>
                      <span className={styles.slideEyebrow}>{t('saleEyebrow')}</span>
                      <h1 className={styles.slideTitle}>{t('saleTitle')}</h1>
                      <p className={styles.slideSub}>{t('saleSub')}</p>
                    </div>
                  ) : meta.href ? (
                    /* ---- Linked slides ---- */
                    <Link href={meta.href} className={styles.slideLabelWrap}>
                      <h2 className={styles.slideLabel}>{copy.label}</h2>
                      {copy.sublabel && (
                        <p className={styles.slideLabelSub}>{copy.sublabel}</p>
                      )}
                      {copy.cta && (
                        <span className={styles.slideCta}>{copy.cta}</span>
                      )}
                    </Link>
                  ) : (
                    /* ---- Non-linked slides ---- */
                    <div className={styles.slideLabelWrap}>
                      <h2 className={styles.slideLabel}>{copy.label}</h2>
                      {copy.sublabel && (
                        <p className={styles.slideLabelSub}>{copy.sublabel}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Dot navigation */}
      <div className={styles.dots}>
        {scrollSnaps.map((_, idx) => (
          <button
            key={idx}
            className={`${styles.dot} ${idx === selectedIndex ? styles.dotActive : ''}`}
            onClick={() => scrollTo(idx)}
            aria-label={t('dotAria', { n: idx + 1 })}
          />
        ))}
      </div>
    </section>
  )
}
