/**
 * Locale + market aware product loader.
 *
 * Composes the unified product registry (`content/products/index.ts`) into the
 * legacy `ProductTemplate` shape, overlaying per-market prices and per-locale
 * content. The single source of truth for a product is its file under
 * `content/products/<slug>.ts`; this module is the server-side projection.
 *
 * Invariants:
 *   - Returns `null` when no content module exists for the requested
 *     `(locale, slug)`. This is how a market hides products that haven't been
 *     translated yet.
 *   - The composed `ProductTemplate.shareUrl` is built from
 *     `absoluteUrl(localizedPath, market)` so emails / OG tags use the
 *     right host AND the localized URL slug.
 *   - Breadcrumb hrefs in the source content are canonical (en) routing paths
 *     (e.g. `/furniture`); this loader rewrites them via `getPathname({ locale })`.
 *   - When the market price is missing the product still renders for preview,
 *     falling back to the registry's display price.
 * Side effects: none (pure composition over static imports).
 */
import type { LocaleKey } from './locales';
import type { MarketKey } from './market-config';
import type { ProductCategory, ProductTemplate, ProductBreadcrumbItem } from '@/lib/product';
import { categoryToProductPathname, categoryToProductRoute, allCategoryKeys } from '@/lib/product';
import type { ProductContent } from '@/lib/product-content';
import { absoluteUrl } from './market-resolver';
import { getMarketPrice } from '@/data/products/prices';
import { getPathname } from './navigation';
import {
  getCrossSell as resolveCrossSell,
  getPopular as resolvePopular,
} from '@/lib/related-products';
import { PRODUCTS } from '@/../content/products';
import { toContent, type DefinedProduct } from '@/lib/product-schema';

const BY_CATEGORY: Record<ProductCategory, DefinedProduct[]> = (() => {
  const out = {} as Record<ProductCategory, DefinedProduct[]>;
  for (const key of allCategoryKeys()) out[key] = [];
  for (const p of PRODUCTS) out[p.category].push(p);
  return out;
})();

const BY_SLUG: Record<string, DefinedProduct> = Object.fromEntries(
  PRODUCTS.map((p) => [p.slug, p]),
);

// Canonical (en) category routes + '/' — the only hrefs stored as breadcrumb
// links. Everything else is left untouched by the localizer.
const LOCALIZABLE_PATHS = new Set<string>(['/', ...allCategoryKeys().map(categoryToProductRoute)]);

interface GetProductArgs {
  locale: LocaleKey;
  market: MarketKey;
  category: ProductCategory;
  slug: string;
}

interface GetCategoryProductsArgs {
  locale: LocaleKey;
  market: MarketKey;
  category: ProductCategory;
}

export function getContent(
  locale: LocaleKey,
  _category: ProductCategory,
  slug: string,
): ProductContent | null {
  const p = BY_SLUG[slug];
  if (!p) return null;
  return toContent(p, locale);
}

function localizeCategoryPath(href: string, locale: LocaleKey): string {
  if (LOCALIZABLE_PATHS.has(href)) {
    // Cast: category pathnames are generated, so they aren't in the statically
    // inferred `routing.pathnames` key union, but they ARE valid keys.
    return getPathname({ href: href as never, locale });
  }
  return href;
}

function localizeBreadcrumbItem(
  item: ProductBreadcrumbItem,
  locale: LocaleKey,
): ProductBreadcrumbItem {
  if (!item.href) return item;
  return { label: item.label, href: localizeCategoryPath(item.href, locale) };
}

function composeProduct(
  defined: DefinedProduct,
  content: ProductContent,
  locale: LocaleKey,
  market: MarketKey,
): ProductTemplate {
  const marketPrice = getMarketPrice(`${defined.category}__${defined.slug}`, market);
  const fallback = defined.business.prices.ro ?? defined.business.prices.english ?? null;
  const price = marketPrice?.price ?? fallback?.price ?? 0;
  const oldPrice = marketPrice?.oldPrice ?? fallback?.oldPrice;

  const localizedProductPath = getPathname({
    href: {
      pathname: categoryToProductPathname(defined.category),
      params: { slug: defined.slug },
    } as never,
    locale,
  });
  const shareUrl = absoluteUrl(localizedProductPath, market);

  return {
    slug: defined.slug,
    category: defined.category,
    shortName: content.shortName,
    fullTitle: content.fullTitle,
    tagline: content.tagline,
    shortDescription: content.shortDescription,
    price,
    oldPrice,
    currency: 'lei',
    inStock: defined.business.inStock,
    preorderNotice: content.preorderNotice,
    availabilityNote: content.availabilityNote,
    badge: content.badge,
    breadcrumb: content.breadcrumb.map((b) => localizeBreadcrumbItem(b, locale)),
    categoryLink: content.categoryLink
      ? localizeBreadcrumbItem(content.categoryLink, locale)
      : undefined,
    shareUrl,
    gallery: content.gallery,
    description: content.description,
    helpContact: content.helpContact,
    reviewsKey: defined.business.reviewsKey,
    upsellSlug: defined.business.upsellSlug,
    crossSellSlugs: defined.business.crossSellSlugs,
    popularSlugs: defined.business.popularSlugs,
  };
}

export function getProduct(args: GetProductArgs): ProductTemplate | null {
  const defined = BY_SLUG[args.slug];
  if (!defined || defined.category !== args.category) return null;
  const content = toContent(defined, args.locale);
  if (!content) return null;
  return composeProduct(defined, content, args.locale, args.market);
}

export function getCategoryProducts(args: GetCategoryProductsArgs): ProductTemplate[] {
  return (BY_CATEGORY[args.category] ?? [])
    .map((defined) => {
      const content = toContent(defined, args.locale);
      if (!content) return null;
      return composeProduct(defined, content, args.locale, args.market);
    })
    .filter((p): p is ProductTemplate => p !== null);
}

interface RelatedArgs {
  product: ProductTemplate;
  locale: LocaleKey;
  market: MarketKey;
}

// Re-resolve each related candidate through `getProduct` so callers always get
// a fully composed, locale-aware, market-priced template (the resolvers in
// `related-products.ts` only work over the registry stubs).

function findLocaleProductBySlug(
  slug: string,
  locale: LocaleKey,
  market: MarketKey,
): ProductTemplate | null {
  const defined = BY_SLUG[slug];
  if (!defined) return null;
  return getProduct({ locale, market, category: defined.category, slug });
}

export function getUpsellForLocale(args: RelatedArgs): ProductTemplate | null {
  if (args.product.upsellSlug) {
    return findLocaleProductBySlug(args.product.upsellSlug, args.locale, args.market);
  }
  // Cheapest sibling strictly more expensive than `product`, measured in the
  // active market's currency.
  const siblings = getCategoryProducts({
    locale: args.locale,
    market: args.market,
    category: args.product.category,
  })
    .filter((p) => p.slug !== args.product.slug && p.price > args.product.price)
    .sort((a, b) => a.price - b.price);
  return siblings[0] ?? null;
}

export function getCrossSellForLocale(args: RelatedArgs): ProductTemplate[] {
  return resolveCrossSell(args.product)
    .map((candidate) =>
      getProduct({
        locale: args.locale,
        market: args.market,
        category: candidate.category,
        slug: candidate.slug,
      }),
    )
    .filter((p): p is ProductTemplate => p !== null);
}

export function getPopularForLocale(args: RelatedArgs): ProductTemplate[] {
  return resolvePopular(args.product)
    .map((candidate) =>
      getProduct({
        locale: args.locale,
        market: args.market,
        category: candidate.category,
        slug: candidate.slug,
      }),
    )
    .filter((p): p is ProductTemplate => p !== null);
}

/**
 * Enumerate all slugs that have content for a given (locale, category). Used by
 * `generateStaticParams` so Next only emits pages that exist in the locale.
 */
export function getStaticSlugsForCategory(
  locale: LocaleKey,
  category: ProductCategory,
): string[] {
  return (BY_CATEGORY[category] ?? [])
    .filter((p) => Boolean(p.locales[locale]))
    .map((p) => p.slug);
}
