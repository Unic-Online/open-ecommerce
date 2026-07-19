'use client';

import { useTranslations } from '@/lib/strings';
import { Link, hrefFor } from '@/lib/nav';
import Image from 'next/image';
import {
  type ProductTemplate,
  categoryToProductPathname,
} from '@/lib/product';
import { useMarket } from '@/lib/market-context';
import { formatMoney } from '@/lib/format';
import styles from './UpsellCard.module.css';

interface Props {
  upsell: ProductTemplate;
  current: ProductTemplate;
}

export default function UpsellCard({ upsell, current }: Props) {
  const t = useTranslations('product.upsell');
  const market = useMarket();
  const pathname = categoryToProductPathname(upsell.category);
  const diff = upsell.price - current.price;
  const cover = upsell.gallery[0];

  return (
    <section className={styles.section}>
      <Link href={hrefFor({ pathname, params: { slug: upsell.slug } })} className={styles.card}>
        <div className={styles.imageWrap}>
          {cover && (
            <Image
              src={cover.src}
              alt={cover.label || upsell.shortName}
              width={120}
              height={120}
              className={styles.image}
            />
          )}
        </div>
        <div className={styles.body}>
          <span className={styles.badge}>{t(`badge.${current.category}`)}</span>
          <h3 className={styles.title}>{upsell.fullTitle}</h3>
          <p className={styles.tagline}>{upsell.tagline}</p>
          <div className={styles.priceRow}>
            <strong className={styles.price}>{formatMoney(upsell.price, market.currency)}</strong>
            {diff > 0 && (
              <span className={styles.priceDiff}>
                {t('priceDiff', {
                  amount: formatMoney(diff, market.currency),
                  name: current.shortName,
                })}
              </span>
            )}
          </div>
        </div>
        <span className={styles.arrow} aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
