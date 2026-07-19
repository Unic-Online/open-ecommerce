/**
 * Resolve the current unit price for a cart item without pulling locale
 * content modules into the client cart bundle.
 *
 * Invariants:
 *   - Mirrors the price resolution in `product-search-index` and
 *     `composeProduct`: per-market override first, registry display price as fallback.
 *   - Returns null when the product is no longer in the registry — caller
 *     should drop the cart item rather than guessing.
 * Side effects: none (pure lookup).
 * Caller contract: callers compare against `unitPrice` stored in localStorage
 *   and drop the item on mismatch so a returning visitor never checks out at
 *   a stale price.
 */
import { getMarketPrice, type MarketKey } from '@/data/products/prices';
import { MARKET_KEY } from '@/lib/market';
import { PRODUCTS } from '@/../content/products';
import type { CartItemData, CartProductType } from './types';

// productType IS the category key; index registry products by category+slug.
const BY_TYPE_SLUG: Record<string, { price: number }> = (() => {
  const out: Record<string, { price: number }> = {};
  for (const p of PRODUCTS) {
    out[`${p.category}__${p.slug}`] = { price: p.business.price };
  }
  return out;
})();

export function getCurrentUnitPrice(
  productType: CartProductType,
  slug: string,
  market: MarketKey = MARKET_KEY,
): number | null {
  const business = BY_TYPE_SLUG[`${productType}__${slug}`];
  if (!business) return null;
  const marketPrice = getMarketPrice(`${productType}__${slug}`, market);
  return marketPrice?.price ?? business.price;
}

/**
 * Refresh a cart snapshot's prices against the current market and drop items
 * whose product is no longer in the registry. Used by the recovery URL flow.
 *
 * Invariant: never returns items whose stored unitPrice differs from the
 * current market price — `loadCart` would drop those on hydration anyway.
 */
export function refreshItemsForMarket(
  items: CartItemData[],
  market: MarketKey = MARKET_KEY,
): CartItemData[] {
  return items
    .map((item) => {
      const current = getCurrentUnitPrice(item.productType, item.slug, market);
      if (current === null) return null;
      return current === item.unitPrice ? item : { ...item, unitPrice: current };
    })
    .filter((it): it is CartItemData => it !== null);
}
