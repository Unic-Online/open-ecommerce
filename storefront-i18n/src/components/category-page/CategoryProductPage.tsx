import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMergedReviews } from '@/lib/reviews-store';
import ProductPage from '@/components/product-template/ProductPage';
import { getProduct } from '@/i18n/product';
import { getMarketForLocale } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';
import type { ProductCategory } from '@/lib/product';

/**
 * Shared product-detail implementation for every category. The thin per-category
 * `[slug]/page.tsx` files delegate here with their category key.
 */
export default async function CategoryProductPage({
  locale,
  category,
  slug,
}: {
  locale: LocaleKey;
  category: ProductCategory;
  slug: string;
}) {
  const market = getMarketForLocale(locale);
  const product = getProduct({ locale, market, category, slug });
  if (!product) notFound();

  const reviews = await getMergedReviews(product.slug, product.reviewsKey, locale);

  let summary: string | undefined;
  if (product.reviewsKey) {
    const t = await getTranslations({ locale, namespace: 'reviews' });
    const key = `summaries.${product.reviewsKey}` as Parameters<typeof t.has>[0];
    if (t.has(key)) {
      const value = t(key);
      summary = value.trim().length > 0 ? value : undefined;
    }
  }

  return <ProductPage product={product} reviews={reviews} reviewsSummary={summary} />;
}
