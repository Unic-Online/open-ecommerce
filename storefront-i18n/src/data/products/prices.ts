/**
 * Per-market price list — the SOURCE OF TRUTH the server uses to charge.
 *
 * Derived from the unified product registry (`content/products/index.ts`):
 * each product declares its per-market prices under `business.prices`, and this
 * module projects them into the `${categoryKey}__${slug}` keyspace the cart
 * resolver and order pipeline expect.
 *
 * Invariants:
 *   - Keys MUST match the `id` from `productCatalog` (i.e. `${cartType}__${slug}`
 *     where `cartType` is the category key).
 *   - `null` for a market means "not purchasable in this market". The cart
 *     resolver returns `unavailable_in_market` and checkout is refused.
 * Side effects: none (pure data).
 */
export type { MarketKey, CurrencyCode } from '@/i18n/market-config';
import type { MarketKey, CurrencyCode } from '@/i18n/market-config';
import { PRODUCTS } from '@/../content/products';

export interface ProductMarketPrice {
  price: number;
  oldPrice?: number;
  currency: CurrencyCode;
}

function buildPrices(): Record<string, Partial<Record<MarketKey, ProductMarketPrice | null>>> {
  const out: Record<string, Partial<Record<MarketKey, ProductMarketPrice | null>>> = {};
  for (const p of PRODUCTS) {
    out[`${p.category}__${p.slug}`] = p.business.prices;
  }
  return out;
}

export const productPrices: Record<
  string,
  Partial<Record<MarketKey, ProductMarketPrice | null>>
> = buildPrices();

export function getMarketPrice(
  productId: string,
  market: MarketKey,
): ProductMarketPrice | null {
  const perMarket = productPrices[productId];
  if (!perMarket) return null;
  return perMarket[market] ?? null;
}
