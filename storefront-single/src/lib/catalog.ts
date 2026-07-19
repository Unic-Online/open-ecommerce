/**
 * Product loader — composes the unified product registry
 * (`content/products/index.ts`) into the `ProductTemplate` shape consumed by
 * the storefront UI.
 *
 * Single-language template: there is no locale or market dimension. Content is
 * read directly off each product's flat `content` block; the share URL is built
 * from the single market host via `absoluteUrl`.
 *
 * Side effects: none (pure composition over static imports).
 */
import type { ProductCategory, ProductTemplate } from '@/lib/product';
import { categoryToProductPathname, categoryToProductRoute, allCategoryKeys } from '@/lib/product';
import type { ProductContent } from '@/lib/product-content';
import { absoluteUrl } from '@/lib/market';
import { hrefFor } from '@/lib/nav';
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

interface GetProductArgs {
  category: ProductCategory;
  slug: string;
}

export function getContent(_category: ProductCategory, slug: string): ProductContent | null {
  const p = BY_SLUG[slug];
  if (!p) return null;
  return toContent(p);
}

function composeProduct(defined: DefinedProduct, content: ProductContent): ProductTemplate {
  const productPath = hrefFor({
    pathname: categoryToProductPathname(defined.category),
    params: { slug: defined.slug },
  });
  const shareUrl = absoluteUrl(productPath);

  return {
    slug: defined.slug,
    category: defined.category,
    shortName: content.shortName,
    fullTitle: content.fullTitle,
    tagline: content.tagline,
    shortDescription: content.shortDescription,
    price: defined.business.price,
    oldPrice: defined.business.oldPrice,
    currency: defined.business.currency,
    inStock: defined.business.inStock,
    preorderNotice: content.preorderNotice,
    availabilityNote: content.availabilityNote,
    badge: content.badge,
    breadcrumb: content.breadcrumb,
    categoryLink: content.categoryLink,
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
  return composeProduct(defined, toContent(defined));
}

export function getCategoryProducts(args: { category: ProductCategory }): ProductTemplate[] {
  return (BY_CATEGORY[args.category] ?? []).map((defined) =>
    composeProduct(defined, toContent(defined)),
  );
}

interface RelatedArgs {
  product: ProductTemplate;
}

function findProductBySlug(slug: string): ProductTemplate | null {
  const defined = BY_SLUG[slug];
  if (!defined) return null;
  return getProduct({ category: defined.category, slug });
}

export function getUpsellForProduct(args: RelatedArgs): ProductTemplate | null {
  if (args.product.upsellSlug) {
    return findProductBySlug(args.product.upsellSlug);
  }
  // Cheapest sibling strictly more expensive than `product`.
  const siblings = getCategoryProducts({ category: args.product.category })
    .filter((p) => p.slug !== args.product.slug && p.price > args.product.price)
    .sort((a, b) => a.price - b.price);
  return siblings[0] ?? null;
}

export function getCrossSellForProduct(args: RelatedArgs): ProductTemplate[] {
  return resolveCrossSell(args.product)
    .map((candidate) => getProduct({ category: candidate.category, slug: candidate.slug }))
    .filter((p): p is ProductTemplate => p !== null);
}

export function getPopularForProduct(args: RelatedArgs): ProductTemplate[] {
  return resolvePopular(args.product)
    .map((candidate) => getProduct({ category: candidate.category, slug: candidate.slug }))
    .filter((p): p is ProductTemplate => p !== null);
}

/** Enumerate all slugs for a category. Used by `generateStaticParams`. */
export function getStaticSlugsForCategory(category: ProductCategory): string[] {
  return (BY_CATEGORY[category] ?? []).map((p) => p.slug);
}

// Backwards-compatible aliases (the *ForLocale names are used by callers that
// haven't been renamed yet).
export const getUpsellForLocale = getUpsellForProduct;
export const getCrossSellForLocale = getCrossSellForProduct;
export const getPopularForLocale = getPopularForProduct;
