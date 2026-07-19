// Helpers that resolve upsell, cross-sell, and "popular products"
// recommendations for any ProductTemplate. The data source is the unified
// product registry (`content/products/index.ts`), projected to legacy
// `ProductTemplate` stubs.
//
// Resolution rules (all overridable per-product via optional fields on
// ProductTemplate):
//
//   getUpsell(p)
//     - If p.upsellSlug is set → return that product (any category)
//     - Else: cheapest sibling in the same category whose price is
//       strictly greater than p's. null when p is already the most
//       expensive.
//
//   getCrossSell(p)
//     - If p.crossSellSlugs is set → return those products
//     - Else: all other products in p's category
//
//   getPopular(p)
//     - If p.popularSlugs is set → return those products
//     - Else: one product per OTHER category (the first slug in each
//       category's registry). Empty categories are skipped.

import type { ProductTemplate, ProductCategory } from './product';
import { allCategoryKeys } from './product';
import { PRODUCTS } from '@/../content/products';
import { toTemplateStub } from './product-schema';

const ALL_CATEGORIES: readonly ProductCategory[] = allCategoryKeys();

const STUBS: ProductTemplate[] = PRODUCTS.map(toTemplateStub);

function byCategory(category: ProductCategory): ProductTemplate[] {
  return STUBS.filter((p) => p.category === category);
}

function findProductBySlug(slug: string): ProductTemplate | null {
  return STUBS.find((p) => p.slug === slug) ?? null;
}

export function getUpsell(product: ProductTemplate): ProductTemplate | null {
  if (product.upsellSlug) {
    return findProductBySlug(product.upsellSlug);
  }
  // Invariant: an upsell must be strictly more expensive than `product`.
  const candidates = byCategory(product.category)
    .filter((p) => p.slug !== product.slug && p.price > product.price)
    .sort((a, b) => a.price - b.price);
  return candidates[0] ?? null;
}

export function getCrossSell(product: ProductTemplate): ProductTemplate[] {
  if (product.crossSellSlugs) {
    return product.crossSellSlugs
      .map((s) => findProductBySlug(s))
      .filter((p): p is ProductTemplate => p !== null);
  }
  return byCategory(product.category).filter((p) => p.slug !== product.slug);
}

export function getPopular(product: ProductTemplate): ProductTemplate[] {
  if (product.popularSlugs) {
    return product.popularSlugs
      .map((s) => findProductBySlug(s))
      .filter((p): p is ProductTemplate => p !== null);
  }
  return ALL_CATEGORIES.filter((c) => c !== product.category)
    .map((c) => byCategory(c)[0])
    .filter((p): p is ProductTemplate => Boolean(p));
}
