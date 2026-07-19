/**
 * Client-safe product index for the header search.
 *
 * Why a parallel loader: `@/lib/catalog` (the server composer) is server-side;
 * the header runs on the client, so it builds a shape-only index here from the
 * same underlying registry + price, without going through the server composer.
 *
 * Invariants:
 *   - `ProductSearchItem` is a strict subset of `ProductTemplate` shape, so
 *     `searchProducts` accepts both.
 * Side effects: none.
 */
import type { ProductCategory } from './product';
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

export function getSearchableProducts(): ProductSearchItem[] {
  return PRODUCTS.map((p) => {
    const content = p.content;
    return {
      slug: p.slug,
      category: p.category,
      shortName: content.shortName,
      fullTitle: content.fullTitle,
      tagline: content.tagline,
      shortDescription: content.shortDescription,
      price: p.business.price,
      gallery: content.gallery.map((g) => ({ src: g.src, label: g.label })),
    };
  });
}
