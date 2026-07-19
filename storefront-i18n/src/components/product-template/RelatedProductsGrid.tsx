import type { ProductTemplate } from '@/lib/product';
import ProductCard, { type ProductReviewStats } from './ProductCard';
import styles from './RelatedProductsGrid.module.css';

interface Props {
  title: string;
  products: ProductTemplate[];
  // When true, prefixes each card with its category — useful for the
  // "popular" grid that mixes categories. Cross-sell omits this since
  // every card belongs to the same category as the page.
  showCategoryLabel?: boolean;
  // Pre-resolved per-category labels (translated by the caller). Keyed by
  // ProductCategory ('furniture' | 'lighting' | 'outdoor'). Optional: if a key
  // is missing, the raw category slug is rendered as a fallback.
  categoryLabels?: Record<string, string>;
  // Per-slug review aggregates so cards render the star row and count.
  reviewStats?: Record<string, ProductReviewStats>;
}

export default function RelatedProductsGrid({
  title,
  products,
  showCategoryLabel = false,
  categoryLabels,
  reviewStats,
}: Props) {
  if (products.length === 0) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.grid}>
        {products.map((p) => (
          <ProductCard
            key={`${p.category}-${p.slug}`}
            product={p}
            categoryLabel={
              showCategoryLabel
                ? categoryLabels?.[p.category] ?? p.category
                : undefined
            }
            reviewStats={reviewStats?.[p.slug]}
          />
        ))}
      </div>
    </section>
  );
}
