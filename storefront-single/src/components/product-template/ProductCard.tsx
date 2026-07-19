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
import styles from './ProductCard.module.css';

export interface ProductReviewStats {
  average: number;
  total: number;
}

interface Props {
  product: ProductTemplate;
  reviewStats?: ProductReviewStats;
  categoryLabel?: string;
}

export default function ProductCard({
  product,
  reviewStats,
  categoryLabel,
}: Props) {
  const t = useTranslations('product');
  const market = useMarket();
  const cover = product.gallery[0];
  const oldPrice = product.oldPrice ?? product.price;
  const savings = oldPrice - product.price;
  const discountPct =
    oldPrice > product.price ? Math.round((savings / oldPrice) * 100) : 0;
  const pathname = categoryToProductPathname(product.category);
  const stockLabel = product.inStock ? t('inStock') : t('preOrder');

  return (
    <Link
      href={hrefFor({ pathname, params: { slug: product.slug } })}
      className={styles.card}
    >
      <div className={styles.imageWrap}>
        {cover && (
          <Image
            src={cover.src}
            alt={cover.label || product.shortName}
            fill
            sizes="(max-width: 600px) 45vw, (max-width: 900px) 33vw, 280px"
            className={styles.image}
          />
        )}
        {discountPct > 0 && (
          <>
            <span className={styles.discountBadge}>-{discountPct}%</span>
            <span className={styles.savingsBadge}>
              -{formatMoney(savings, market.currency)}
            </span>
          </>
        )}
      </div>
      <div className={styles.body}>
        {categoryLabel && (
          <span className={styles.categoryLabel}>{categoryLabel}</span>
        )}
        <h3 className={styles.name}>
          {product.shortName} — {product.tagline}
        </h3>
        <div className={styles.footer}>
          <div className={styles.prices}>
            {product.oldPrice && product.oldPrice > product.price && (
              <span className={styles.priceOld}>
                {formatMoney(product.oldPrice, market.currency)}
              </span>
            )}
            <span className={styles.priceNew}>
              {formatMoney(product.price, market.currency)}
            </span>
          </div>
          <span className={styles.stockBadge}>{stockLabel}</span>
        </div>
        {reviewStats && (
          <div className={styles.rating}>
            <span className={styles.stars}>
              {'★'.repeat(Math.round(reviewStats.average))}
              {'☆'.repeat(5 - Math.round(reviewStats.average))}
            </span>
            <span className={styles.reviewCount}>({reviewStats.total})</span>
          </div>
        )}
        {product.shortDescription && (
          <p className={styles.desc}>{product.shortDescription}</p>
        )}
      </div>
    </Link>
  );
}
