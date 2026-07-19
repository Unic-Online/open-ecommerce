import { getTranslations } from '@/lib/strings';
import { getCategoryProducts } from '@/lib/catalog';
import { getReviews } from '@/data/reviews-registry';
import { summarizeReviews } from '@/lib/reviews';
import ProductCard, { type ProductReviewStats } from '@/components/product-template/ProductCard';
import type { ProductCategory } from '@/lib/product';
import styles from './CategoryListingPage.module.css';

/**
 * Shared listing implementation for every product category. The thin per-category
 * route files (`src/app/<key>/page.tsx`) delegate here with their category key —
 * so adding a category is one config entry + two tiny files.
 *
 * Header copy reads `common.categoryHeader.<category>` (eyebrow/title/subtitle).
 */
export default async function CategoryListingPage({
  category,
}: {
  category: ProductCategory;
}) {
  const products = getCategoryProducts({ category });
  const tHeader = await getTranslations(`common.categoryHeader.${category}`);

  const reviewStats: Record<string, ProductReviewStats> = {};
  for (const product of products) {
    const reviews = getReviews(product.reviewsKey ?? product.slug);
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
