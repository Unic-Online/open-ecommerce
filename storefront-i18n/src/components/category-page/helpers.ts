import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getProduct, getStaticSlugsForCategory } from '@/i18n/product';
import { getMarketForLocale } from '@/i18n/market-config';
import { categoryToProductRoute } from '@/lib/product';
import { alternatesMetadata } from '@/lib/seo/alternates';
import { routing } from '@/i18n/routing';
import { brand } from '@/site.config';
import type { LocaleKey } from '@/i18n/locales';
import type { ProductCategory } from '@/lib/product';

/** generateStaticParams for a category listing's `[slug]` route. */
export function categorySlugParams(category: ProductCategory) {
  const params: Array<{ locale: LocaleKey; slug: string }> = [];
  for (const locale of routing.locales) {
    for (const slug of getStaticSlugsForCategory(locale, category)) {
      params.push({ locale, slug });
    }
  }
  return params;
}

/** Metadata for a category listing page. */
export async function categoryListingMetadata(
  locale: LocaleKey,
  category: ProductCategory,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `common.seo.${category}` });
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesMetadata(categoryToProductRoute(category) as never, locale),
  };
}

/** Metadata for a category product-detail page. */
export async function categoryProductMetadata(
  locale: LocaleKey,
  category: ProductCategory,
  slug: string,
): Promise<Metadata> {
  const market = getMarketForLocale(locale);
  const product = getProduct({ locale, market, category, slug });
  if (!product) return {};
  return {
    title: `${product.shortName} — ${product.tagline} | ${brand.siteName}`,
    description: product.shortDescription,
    alternates: alternatesMetadata(
      { pathname: `${categoryToProductRoute(category)}/[slug]`, params: { slug } } as never,
      locale,
    ),
  };
}
