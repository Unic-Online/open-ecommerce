import { getTranslations } from 'next-intl/server';
import { getCategoryProducts } from '@/i18n/product';
import { getMarketForLocale } from '@/i18n/market-config';
import { getReviewsByLocale } from '@/data/reviews-registry';
import { summarizeReviews } from '@/lib/reviews';
import ProductCard, { type ProductReviewStats } from '@/components/product-template/ProductCard';
import type { LocaleKey } from '@/i18n/locales';
import type { ProductCategory } from '@/lib/product';
import styles from './CategoryListingPage.module.css';

/**
 * Shared listing implementation for every product category. The thin per-category
 * route files (`src/app/[locale]/<key>/page.tsx`) delegate here with their
 * category key — so adding a category is one config entry + two tiny files.
 *
 * Header copy reads `common.categoryHeader.<category>` (eyebrow/title/subtitle).
 */
export default async function CategoryListingPage({
  locale,
  category,
}: {
  locale: LocaleKey;
  category: ProductCategory;
}) {
  const market = getMarketForLocale(locale);
  const products = getCategoryProducts({ locale, market, category });
  const tHeader = await getTranslations({ locale, namespace: `common.categoryHeader.${category}` });

  const reviewStats: Record<string, ProductReviewStats> = {};
  for (const product of products) {
    const reviews = getReviewsByLocale(product.reviewsKey ?? product.slug, locale);
    if (reviews.length === 0) continue;
    const s = summarizeReviews(reviews);
    reviewStats[product.slug] = { average: s.average, total: s.total };
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>{tHeader('eyebrow')}</span>
        <h1 className={styles.title}>{tHeader('title')}</h1>
        <p className={styles.subtitle}>{tHeader('subtitle')}</p>
      </header>

      <ul className={styles.grid} role="list">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} reviewStats={reviewStats[product.slug]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
