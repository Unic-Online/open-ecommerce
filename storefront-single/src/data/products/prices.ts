/**
 * Price list — the SOURCE OF TRUTH the server uses to charge.
 *
 * Derived from the unified product registry (`content/products/index.ts`):
 * each product declares its `business.price`, and this module projects it into
 * the `${categoryKey}__${slug}` keyspace the cart resolver and order pipeline
 * expect, under the single market key.
 *
 * Invariants:
 *   - Keys MUST match the `id` from `productCatalog` (i.e. `${cartType}__${slug}`
 *     where `cartType` is the category key).
 *   - `null` means "not purchasable". The cart resolver returns
 *     `unavailable_in_market` and checkout is refused.
 * Side effects: none (pure data).
 */
export type { MarketKey, CurrencyCode } from '@/lib/market';
import { MARKET_KEY, type MarketKey, type CurrencyCode } from '@/lib/market';
import { PRODUCTS } from '@/../content/products';

export interface ProductMarketPrice {
  price: number;
  oldPrice?: number;
  currency: CurrencyCode;
}

function buildPrices(): Record<string, Partial<Record<MarketKey, ProductMarketPrice | null>>> {
  const out: Record<string, Partial<Record<MarketKey, ProductMarketPrice | null>>> = {};
  for (const p of PRODUCTS) {
    out[`${p.category}__${p.slug}`] = {
      [MARKET_KEY]: {
        price: p.business.price,
        oldPrice: p.business.oldPrice,
        currency: p.business.currency,
      },
    };
  }
  return out;
}

export const productPrices: Record<
  string,
  Partial<Record<MarketKey, ProductMarketPrice | null>>
> = buildPrices();

export function getMarketPrice(
  productId: string,
  market: MarketKey = MARKET_KEY,
): ProductMarketPrice | null {
  const perMarket = productPrices[productId];
  if (!perMarket) return null;
  return perMarket[market] ?? null;
}
