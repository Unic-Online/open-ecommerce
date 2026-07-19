/**
 * Client-safe product index for the header search.
 *
 * Why a parallel loader: `@/i18n/product` (the canonical composer) transitively
 * imports `next/headers` via `market-resolver`, which poisons any client
 * bundle that pulls it in. The header runs on the client, so it builds a
 * shape-only index here from the same underlying registry + per-market prices,
 * without going through the server composer.
 *
 * Invariants:
 *   - `ProductSearchItem` is a strict subset of `ProductTemplate` shape, so
 *     `searchProducts` accepts both.
 *   - Returns the per-market price; falls back to the registry display price
 *     when no market-specific price exists, mirroring `composeProduct`.
 *   - Filters out `(locale, slug)` pairs missing locale content.
 * Side effects: none.
 */
import type { ProductCategory } from './product';
import { getMarketPrice, type MarketKey } from '@/data/products/prices';
import type { LocaleKey } from '@/i18n/locales';
import { PRODUCTS } from '@/../content/products';

export interface ProductSearchItem {
  slug: string;
  category: ProductCategory;
  shortName: string;
  fullTitle: string;
  tagline: string;
  shortDescription: string;
  price: number;
  gallery: { src: string; label: string }[];
}

export function getSearchableProducts(locale: LocaleKey, market: MarketKey): ProductSearchItem[] {
  const out: ProductSearchItem[] = [];

  for (const p of PRODUCTS) {
    const content = p.locales[locale];
    if (!content) continue;

    const marketPrice = getMarketPrice(`${p.category}__${p.slug}`, market);
    const fallback = p.business.prices.ro ?? p.business.prices.english ?? null;
    const price = marketPrice?.price ?? fallback?.price ?? 0;

    out.push({
      slug: p.slug,
      category: p.category,
      shortName: content.shortName,
      fullTitle: content.fullTitle,
      tagline: content.tagline,
      shortDescription: content.shortDescription,
      price,
      gallery: content.gallery.map((g) => ({ src: g.src, label: g.label })),
    });
  }

  return out;
}
