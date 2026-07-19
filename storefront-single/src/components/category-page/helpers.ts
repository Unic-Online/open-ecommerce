import type { Metadata } from 'next';
import { getProduct, getStaticSlugsForCategory } from '@/lib/catalog';
import { categoryToProductRoute } from '@/lib/product';
import { alternatesMetadata } from '@/lib/seo/alternates';
import { brand } from '@/site.config';
import type { ProductCategory } from '@/lib/product';
import { getTranslations } from '@/lib/strings';

/** generateStaticParams for a category listing's `[slug]` route. */
export function categorySlugParams(category: ProductCategory) {
  return getStaticSlugsForCategory(category).map((slug) => ({ slug }));
}

/** Metadata for a category listing page. */
export async function categoryListingMetadata(category: ProductCategory): Promise<Metadata> {
  const t = await getTranslations(`common.seo.${category}`);
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesMetadata(categoryToProductRoute(category)),
  };
}

/** Metadata for a category product-detail page. */
export async function categoryProductMetadata(
  category: ProductCategory,
  slug: string,
): Promise<Metadata> {
  const product = getProduct({ category, slug });
  if (!product) return {};
  return {
    title: `${product.shortName} — ${product.tagline} | ${brand.siteName}`,
    description: product.shortDescription,
    alternates: alternatesMetadata({
      pathname: `${categoryToProductRoute(category)}/[slug]`,
      params: { slug },
    }),
  };
}
