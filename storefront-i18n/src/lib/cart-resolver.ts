/**
 * Server-trusted cart resolver — converts client cart items into server-priced lines.
 *
 * Invariants:
 *   - Server NEVER trusts client-supplied `unitPrice` for charging. It is read
 *     from `productPrices[id][market]` only. Display fields (productName, image,
 *     slug, shortName, productType) ARE passed through from the client because
 *     they only affect rendering of order docs/emails — not the amount charged.
 *   - All resolved lines must share a single currency. Mixed-currency carts are
 *     rejected with `currency_mismatch` so we never silently sum RON + EUR.
 *   - `inStock=false` does NOT block today (SF01 is a preorder product). Add a
 *     stock-blocking signal here when a product needs hard out-of-stock semantics.
 * Side effects: none (pure function).
 * Caller contract: route handlers MUST inspect `result.ok`. On `false`, return
 *   400 with a Romanian error message mapped from `result.reason`.
 */
import type { CartProductType } from './types';
import { getCatalogEntry } from '@/data/products/catalog';
import { getMarketPrice, type CurrencyCode, type MarketKey } from '@/data/products/prices';

export type { MarketKey, CurrencyCode };

// Server-side resolver input. We accept the wire shape from `orderRequestSchema`
// (which lacks `image`) AND the client cart shape from `CartItemData` (which has it).
// `image` is optional here because the order schema doesn't require it; emails
// fall back to "" when missing.
export interface CartResolverInput {
  id: string;
  productName: string;
  shortName: string;
  slug: string;
  quantity: number;
  // Client-supplied; ignored for charging — server reads catalog price.
  unitPrice?: number;
  image?: string;
}

export interface ResolvedCartLine {
  // `id` mirrors `OrderItem.id` so resolved lines drop into the existing
  // emails/saveOrder pipeline without a parallel shape. `productId` is the
  // same value, kept as a forward-compatible alias for code that wants to
  // make the catalog-key intent explicit.
  id: string;
  productId: string;
  quantity: number;
  // Server-trust: pulled from catalog, not from client input.
  unitPrice: number;
  currency: CurrencyCode;
  // Display pass-throughs — used by emails / persisted order doc.
  productName: string;
  image: string;
  slug: string;
  shortName: string;
  productType: CartProductType;
}

export type ResolveCartResult =
  | { ok: true; lines: ResolvedCartLine[]; currency: CurrencyCode }
  | {
      ok: false;
      reason:
        | 'unknown_product'
        | 'unavailable_in_market'
        | 'currency_mismatch'
        | 'out_of_stock_blocking';
      productId?: string;
    };

export function resolveCartForMarket(
  items: ReadonlyArray<CartResolverInput>,
  market: MarketKey,
): ResolveCartResult {
  const lines: ResolvedCartLine[] = [];
  let currency: CurrencyCode | null = null;

  for (const item of items) {
    const entry = getCatalogEntry(item.id);
    if (!entry) {
      return { ok: false, reason: 'unknown_product', productId: item.id };
    }

    const marketPrice = getMarketPrice(item.id, market);
    if (!marketPrice) {
      return { ok: false, reason: 'unavailable_in_market', productId: item.id };
    }

    if (currency === null) {
      currency = marketPrice.currency;
    } else if (currency !== marketPrice.currency) {
      return { ok: false, reason: 'currency_mismatch', productId: item.id };
    }

    lines.push({
      id: entry.id,
      productId: entry.id,
      quantity: item.quantity,
      // Server-trust: catalog price overrides whatever the client sent.
      unitPrice: marketPrice.price,
      currency: marketPrice.currency,
      productName: item.productName,
      image: item.image ?? '',
      slug: item.slug,
      shortName: item.shortName,
      productType: entry.cartType,
    });
  }

  // Empty cart: schema enforces min 1 item upstream so this is defensive only.
  // We default to RON to keep the type narrow; callers should never see it.
  return { ok: true, lines, currency: currency ?? 'RON' };
}
