/**
 * Per-market commerce helpers — domain, currency, shipping, contact, legal.
 *
 * The market DATA (`MARKETS`, `DEFAULT_MARKET`) and types now live in
 * `src/site.config.ts` (the single source of truth for all site config).
 * This module re-exports them and keeps the pure derivation helpers so its
 * ~40 consumers (`getMarketConfig`, `getMarketForLocale`, `getRoutingDomains`,
 * `getHostMarketMap`, plus the `MarketKey` / `MarketConfig` types) don't change.
 *
 * Invariants:
 *   - `MarketKey` ('ro' | 'french' | 'english') is the COMMERCIAL market —
 *     currency, shipping, legal entity. `LocaleKey` ('ro' | 'fr' | 'en') is the
 *     UI language. They overlap on `ro`, but a market always has exactly one
 *     default locale; a locale could theoretically span multiple markets.
 *   - `baseUrl` MUST not have a trailing slash. `absoluteUrl` joins by inserting
 *     exactly one `/` between `baseUrl` and the path.
 * Side effects: none (pure data re-export + getters).
 */
import type { LocaleKey } from './locales';
import {
  MARKETS,
  DEFAULT_MARKET,
  type MarketKey,
  type CurrencyCode,
  type MarketConfig,
} from '@/site.config';

export { MARKETS, DEFAULT_MARKET };
export type { MarketKey, CurrencyCode, MarketConfig };

export function getMarketConfig(key: MarketKey): MarketConfig {
  return MARKETS[key];
}

/**
 * Pure locale→market resolver for storefront pages.
 *
 * Why: production routing (`src/i18n/routing.ts: domains`) already enforces a
 * 1:1 host↔locale split — `shop.example.com` serves only `en`, `ro.shop.example.com`
 * serves only `ro`. So once we know the locale segment of the URL, the market
 * is fully determined; reading the host header on top is redundant and (more
 * importantly) opts the page out of static rendering.
 *
 * Storefront pages should use this instead of the async `getCurrentMarket()`
 * so they stay statically renderable. API routes / the merchant feed still
 * need the request-bound resolver because those have legitimate per-request
 * inputs.
 */
export function getMarketForLocale(locale: LocaleKey): MarketKey {
  for (const m of Object.values(MARKETS)) {
    if (m.locale === locale) return m.key;
  }
  return DEFAULT_MARKET;
}

/**
 * Derived shape consumed by `next-intl`'s `defineRouting({ domains })`.
 * The locale array is `[market.locale]` — each production domain serves
 * exactly one locale. Local dev (`localhost`) and Vercel preview hosts fall
 * through to `localePrefix: 'as-needed'` and use `/fr/` prefix routing.
 *
 * Single source of truth: edit `MARKETS` in site.config.ts and both this and
 * the host→market resolver pick up the new domain automatically.
 */
export function getRoutingDomains(): Array<{
  domain: string;
  defaultLocale: LocaleKey;
  locales: LocaleKey[];
}> {
  return Object.values(MARKETS).map((m) => ({
    domain: m.domain,
    defaultLocale: m.locale,
    locales: [m.locale],
  }));
}

/**
 * Derived map consumed by `market-resolver.ts`. Includes primary domain plus
 * every `domainAliases` entry, lowercased for case-insensitive lookup.
 */
export function getHostMarketMap(): Record<string, MarketKey> {
  const map: Record<string, MarketKey> = {};
  for (const m of Object.values(MARKETS)) {
    map[m.domain.toLowerCase()] = m.key;
    for (const alias of m.domainAliases ?? []) {
      map[alias.toLowerCase()] = m.key;
    }
  }
  return map;
}
