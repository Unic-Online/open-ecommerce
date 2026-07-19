import type { CurrencyCode } from '@/lib/market';
import { MARKET } from '@/site.config';

const BCP47 = MARKET.languageTag;

/**
 * Currency-aware money formatting. Uses Intl.NumberFormat with the currency
 * style and zero fraction digits.
 *
 * Defensive: if `currency` is missing (legacy order docs persisted before the
 * field was required), fall back to a plain number format so admin dashboards
 * don't 500 on stale data. A console.warn keeps the data-quality issue visible.
 */
export function formatMoney(amount: number, currency?: CurrencyCode): string {
  if (!currency) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[formatMoney] missing currency for amount=${amount} — rendering plain number`,
      );
    }
    return new Intl.NumberFormat(BCP47, { maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat(BCP47, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Convenience: format an amount in the single market's currency. */
export function formatPrice(price: number): string {
  return formatMoney(price, MARKET.currency);
}

export function makeCartItemId(colorId: string, sizeId: string, weightId: string): string {
  return `${colorId}__${sizeId}__${weightId}`;
}
