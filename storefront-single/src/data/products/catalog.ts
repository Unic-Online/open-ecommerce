/**
 * Server-side product catalog — business-only fields needed for cart/order validation.
 *
 * Derived from the unified product registry (`content/products/index.ts`).
 *
 * Invariants:
 *   - The `id` is the canonical cart item id, formed as `${categoryKey}__${slug}`
 *     to mirror what `ProductBuyBox`/`FloatingCartBar` write into localStorage.
 *     Changing the format silently breaks existing carts; do not migrate without
 *     a cart-side normalizer.
 *   - Every product known to the storefront MUST appear here (it does, because
 *     both this file and the rest of the app read the same registry).
 *   - Pricing lives in `./prices.ts`, NOT here. This module is identity + stock only.
 * Side effects: none (pure data).
 * Caller contract: do not import this from client components — keep server-trust
 *   data on the server side of the bundle.
 */
import type { ProductCategory, CartProductType } from '@/lib/product';
import { PRODUCTS } from '@/../content/products';

export interface ProductCatalogEntry {
  id: string;
  category: ProductCategory;
  slug: string;
  cartType: CartProductType;
  inStock: boolean;
  reviewsKey?: string;
}

function buildCatalog(): Record<string, ProductCatalogEntry> {
  const out: Record<string, ProductCatalogEntry> = {};
  for (const p of PRODUCTS) {
    // Cart-id convention: must match `ProductBuyBox`/`FloatingCartBar`.
    const id = `${p.category}__${p.slug}`;
    const entry: ProductCatalogEntry = {
      id,
      category: p.category,
      slug: p.slug,
      cartType: p.category,
      inStock: p.business.inStock,
    };
    if (p.business.reviewsKey) entry.reviewsKey = p.business.reviewsKey;
    out[id] = entry;
  }
  return out;
}

export const productCatalog: Record<string, ProductCatalogEntry> = buildCatalog();

export function getCatalogEntry(productId: string): ProductCatalogEntry | null {
  return productCatalog[productId] ?? null;
}
