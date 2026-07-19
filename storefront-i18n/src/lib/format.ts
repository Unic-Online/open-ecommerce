import type { CurrencyCode } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';

const LOCALE_TO_BCP47: Record<LocaleKey, string> = {
  ro: 'ro-RO',
  en: 'en-GB',
};

/**
 * Market/locale-aware money formatting. Uses Intl.NumberFormat with the
 * currency style and zero fraction digits to preserve the existing
 * "1780 RON" presentation in RO. New code should call this instead of
 * `formatPrice`.
 *
 * Defensive: if `currency` is missing (legacy order docs persisted before
 * the field was required), fall back to a locale-only number format so
 * admin dashboards don't 500 on stale data. A console.warn keeps the
 * data-quality issue visible.
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode | undefined,
  locale: LocaleKey,
): string {
  if (!currency) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[formatMoney] missing currency for amount=${amount} locale=${locale} — rendering plain number`,
      );
    }
    return new Intl.NumberFormat(LOCALE_TO_BCP47[locale], {
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat(LOCALE_TO_BCP47[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Backward-compatible RO-only helper. Preserved for callers that still
// hardcode the Romanian "<n> RON" format (email templates, legacy data).
export function formatPrice(price: number): string {
  return `${price} RON`
}

export function makeCartItemId(colorId: string, sizeId: string, weightId: string): string {
  return `${colorId}__${sizeId}__${weightId}`
}
