/**
 * Pricing math — single source of truth for order totals.
 *
 * Invariants:
 *   - Server always recomputes totals from raw items; client-supplied prices are informational only.
 *   - Stacked welcome+coupon discount capped at 95% so subtotal-discount stays positive.
 *   - `toMinorUnits` converts stored major-unit prices to minor units; ZERO_DECIMAL_CURRENCIES skip the ×100.
 * Side effects: none (pure functions).
 * Caller contract: pass items with `unitPrice` already resolved per the line-item rules in `lib/line-items.ts`.
 */
export const WELCOME_DISCOUNT = 0.10;
// Pre-rounded percent for UI copy. Single source of truth so checkout,
// cart, and the welcome popup never drift out of sync with the math.
export const WELCOME_DISCOUNT_PERCENT = Math.round(WELCOME_DISCOUNT * 100);
// Single-market shipping defaults (EUR). Mirror `MARKET.shipping` in
// site.config.ts — €10 flat, free over €300.
export const STANDARD_SHIPPING_COST = 10;
export const FREE_SHIPPING_THRESHOLD = 300;

export interface ShippingConfig {
  standardCost: number;
  freeThreshold: number;
}

// Default shipping config. Callers with no `shipping` option fall back to this.
export const DEFAULT_SHIPPING: ShippingConfig = {
  standardCost: STANDARD_SHIPPING_COST,
  freeThreshold: FREE_SHIPPING_THRESHOLD,
};

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
}

interface PricedItem {
  quantity: number
  unitPrice: number
}

export interface ComputeOrderOptions {
  // Recovery-coupon discount %, stacked on top of the default welcome
  // discount. e.g. 10 → final discount = 10% + 10% = 20%. Capped to ensure
  // the post-discount subtotal never goes below 1 unit.
  couponDiscountPercent?: number;
  // Shipping config. When omitted, defaults to DEFAULT_SHIPPING.
  shipping?: ShippingConfig;
}

export function computeSubtotal<T extends PricedItem>(items: ReadonlyArray<T>): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function computeShippingCost(
  subtotal: number,
  shipping: ShippingConfig = DEFAULT_SHIPPING,
): number {
  if (subtotal <= 0) return 0;
  return subtotal >= shipping.freeThreshold ? 0 : shipping.standardCost;
}

export function computeOrderTotal<T extends PricedItem>(
  items: ReadonlyArray<T>,
  options: ComputeOrderOptions = {},
): PriceBreakdown {
  const subtotal = computeSubtotal(items);
  const couponPct = Math.max(
    0,
    Math.min(80, options.couponDiscountPercent ?? 0),
  );
  // Stacked: welcome discount (10%) + coupon %. Capped so subtotal-discount
  // stays positive even on a 1-unit cart with an aggressive coupon.
  const totalPct = Math.min(WELCOME_DISCOUNT + couponPct / 100, 0.95);
  const discount = Math.round(subtotal * totalPct);
  const shippingCost = computeShippingCost(subtotal, options.shipping ?? DEFAULT_SHIPPING);
  const total = Math.max(0, subtotal - discount + shippingCost);
  return { subtotal, discount, shippingCost, total };
}

export function toMinorUnits(amount: number, currency: string): number {
  // RON, EUR, USD, GBP all use 2 decimals; product prices in this codebase are stored as whole RON.
  // We treat the stored integer as the major unit (e.g. 199 = 199.00 RON) and convert to bani.
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return Math.round(amount * 10 ** decimals);
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
