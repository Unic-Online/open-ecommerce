import { notFound } from 'next/navigation';
import { getTranslations } from '@/lib/strings';
import { getMergedReviews } from '@/lib/reviews-store';
import ProductPage from '@/components/product-template/ProductPage';
import { getProduct } from '@/lib/catalog';
import type { ProductCategory } from '@/lib/product';

/**
 * Shared product-detail implementation for every category. The thin per-category
 * `[slug]/page.tsx` files delegate here with their category key.
 */
export default async function CategoryProductPage({
  category,
  slug,
}: {
  category: ProductCategory;
  slug: string;
}) {
  const product = getProduct({ category, slug });
  if (!product) notFound();

  // DB-approved reviews (moderated via /admin/reviews) merged ahead of the
  // curated/static corpus — see lib/reviews-store.ts:getMergedReviews.
  const reviews = await getMergedReviews(product.slug, product.reviewsKey);

  let summary: string | undefined;
  if (product.reviewsKey) {
    const t = await getTranslations('reviews');
    const key = `summaries.${product.reviewsKey}`;
    if (t.has(key)) {
      const value = t(key);
      summary = value.trim().length > 0 ? value : undefined;
    }
  }

  return <ProductPage product={product} reviews={reviews} reviewsSummary={summary} />;
}
