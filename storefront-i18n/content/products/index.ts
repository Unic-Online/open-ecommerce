/**
 * Product registry — one import line per product.
 *
 * The single enumerable source of all products. Every adapter (i18n composer,
 * catalog, prices, search index, reviews, sitemap, merchant feed) iterates
 * `PRODUCTS` or looks up `PRODUCT_BY_SLUG`. Adding a product = create
 * `content/products/<slug>.ts` and add one import + one array entry here.
 */
import type { DefinedProduct } from '@/lib/product-schema';
import { product as osloNightstand } from './oslo-nightstand';
import { product as ariaConsole } from './aria-console';
import { product as haloTableLamp } from './halo-table-lamp';
import { product as lumenFloorLamp } from './lumen-floor-lamp';
import { product as terraPathLight } from './terra-path-light';

export const PRODUCTS: DefinedProduct[] = [
  osloNightstand,
  ariaConsole,
  haloTableLamp,
  lumenFloorLamp,
  terraPathLight,
];

export const PRODUCT_BY_SLUG: Record<string, DefinedProduct> = Object.fromEntries(
  PRODUCTS.map((p) => [p.slug, p]),
);

export function getDefinedProduct(slug: string): DefinedProduct | null {
  return PRODUCT_BY_SLUG[slug] ?? null;
}
