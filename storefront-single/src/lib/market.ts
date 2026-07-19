/**
 * Single-market commerce config — currency, shipping, contact, legal, domain.
 *
 * The template serves ONE commercial market (English / EUR on a single host),
 * so there is no host-based resolution and no per-locale market map. The shape
 * is preserved (so the cart resolver, pricing, admin filter, and merchant feed
 * keep their structure) but degenerated to a single key.
 *
 * Invariants:
 *   - `baseUrl` MUST not have a trailing slash. `absoluteUrl` joins by
 *     inserting exactly one `/` between `baseUrl` and the path.
 * Side effects: none (pure data + getters).
 */
import { MARKET, MARKET_KEY, type MarketConfig, type CurrencyCode, type MarketKey } from '@/site.config';

export { MARKET, MARKET_KEY };
export type { MarketConfig, CurrencyCode, MarketKey };

/** The single market config. Takes no argument — there is only one market. */
export function getMarketConfig(): MarketConfig {
  return MARKET;
}

/**
 * Build an absolute URL on the single market host. Used in emails, OG tags,
 * and recovery links — anywhere the request host isn't available because the
 * code path is a background job, a webhook, or a cron tick.
 */
export function absoluteUrl(path: string): string {
  const safe = path.startsWith('/') ? path : `/${path}`;
  return `${MARKET.baseUrl}${safe}`;
}
