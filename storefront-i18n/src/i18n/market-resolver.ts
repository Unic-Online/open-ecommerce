/**
 * Resolve the active commercial market from the request host.
 *
 * Invariants:
 *   - Host lookup is case-insensitive. Port is stripped for the apex/host map
 *     but preserved when matching `localhost:3000` exactly.
 *   - Unknown hosts (e.g. preview deployments) fall back to `DEFAULT_MARKET`.
 *     This keeps the storefront working on Vercel preview domains without an
 *     explicit registration step.
 *   - `getCurrentMarket` reads `next/headers` and is async — it can ONLY run
 *     in a server component / route handler / server action. Route handlers
 *     that already have a `Request` should prefer `resolveMarketFromRequest`.
 * Side effects: `getCurrentMarket` reads request headers via `next/headers`.
 *   `resolveMarketFromHost` and `resolveMarketFromRequest` are pure.
 */
import { headers } from 'next/headers';
import {
  DEFAULT_MARKET,
  MARKETS,
  getHostMarketMap,
  type MarketKey,
} from './market-config';

// Production hosts come from MARKETS via the derived helper. Editing MARKETS
// (adding a market, adding an alias) automatically updates this layer.
const PROD_HOST_MAP = getHostMarketMap();

// Dev convenience — kept separate from MARKETS so production config stays
// clean. Local dev resolves to RO so the existing storefront works without
// /etc/hosts tricks; FR can still be previewed via /fr/ prefix.
const DEV_HOST_MAP: Record<string, MarketKey> = {
  'localhost': 'ro',
  'localhost:3000': 'ro',
};

/**
 * Match a host against the PRODUCTION domain set only (primary domains,
 * aliases, and their subdomains). Returns null for dev hosts (`localhost`)
 * and unknown hosts (Vercel previews) — the callers that need those fall
 * back to `DEV_HOST_MAP` / `DEFAULT_MARKET`.
 *
 * Server-trust: a non-null result means the request is production traffic,
 * which must be host-routed exclusively — see `resolveMarketFromRequest`.
 */
function matchProductionMarket(host: string | null | undefined): MarketKey | null {
  if (!host) return null;
  const lower = host.toLowerCase();
  // 1) Exact match (with port preserved, e.g. a hypothetical `domain:8443`).
  if (PROD_HOST_MAP[lower]) return PROD_HOST_MAP[lower];
  const normalized = lower.split(':')[0];
  if (PROD_HOST_MAP[normalized]) return PROD_HOST_MAP[normalized];
  // 2) Subdomain fallback — covers hosts like `staging.shop.example.com`
  //    without enumerating every slug. Walks the primary domain AND every
  //    alias (e.g. apex `shop.example.com` is an alias of the
  //    `www.shop.example.com` serving host; staging.shop.example.com matches
  //    via the apex alias). Derived from MARKETS so a new market's domains
  //    are auto-covered.
  for (const m of Object.values(MARKETS)) {
    const candidates = [m.domain, ...(m.domainAliases ?? [])].map((h) =>
      h.toLowerCase().split(':')[0],
    );
    for (const root of candidates) {
      if (normalized === root || normalized.endsWith(`.${root}`)) return m.key;
    }
  }
  return null;
}

export function resolveMarketFromHost(host: string | null | undefined): MarketKey {
  if (!host) return DEFAULT_MARKET;
  const production = matchProductionMarket(host);
  if (production) return production;
  const lower = host.toLowerCase();
  if (DEV_HOST_MAP[lower]) return DEV_HOST_MAP[lower];
  const normalized = lower.split(':')[0];
  if (DEV_HOST_MAP[normalized]) return DEV_HOST_MAP[normalized];
  return DEFAULT_MARKET;
}

export async function getCurrentMarket(): Promise<MarketKey> {
  const h = await headers();
  return resolveMarketFromHost(h.get('host'));
}

/**
 * Allow QA + Vercel preview deploys to force a market via the `__market`
 * query string or cookie. This unblocks FR-market preview testing on
 * `*.vercel.app` hosts that don't match any production domain alias.
 *
 * Production traffic is host-routed, so this override only fires on
 * preview/dev hosts — `localhost` and `*.vercel.app` would otherwise
 * resolve to `DEFAULT_MARKET = 'ro'`.
 */
const MARKET_OVERRIDE_QUERY = '__market';
const MARKET_OVERRIDE_COOKIE = 'sf_market_override';

function isMarketKey(value: string | null | undefined): value is MarketKey {
  return value === 'ro' || value === 'english';
}

function readMarketOverride(req: Request): MarketKey | null {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get(MARKET_OVERRIDE_QUERY);
    if (isMarketKey(q)) return q;
  } catch {
    /* ignore malformed URL */
  }
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === MARKET_OVERRIDE_COOKIE) {
        const v = decodeURIComponent(rest.join('='));
        if (isMarketKey(v)) return v;
      }
    }
  }
  return null;
}

export function resolveMarketFromRequest(req: Request): MarketKey {
  const host = req.headers.get('host');
  // Server-trust: production traffic is host-routed EXCLUSIVELY. Honoring the
  // override on a production host would let any visitor force a foreign
  // market on the money paths (/api/order, create-order) — e.g. re-enable
  // cash-on-delivery on a card-only market or charge another market's price
  // table — with a query param. The escape hatch stays usable on localhost
  // and unknown (Vercel preview) hosts only.
  const production = matchProductionMarket(host);
  if (production) return production;
  const override = readMarketOverride(req);
  if (override) return override;
  return resolveMarketFromHost(host);
}

/**
 * Build an absolute URL for the given market. Used in emails, OG tags, and
 * recovery links — anywhere the request host isn't available because the
 * code path is a background job, a webhook, or a cron tick.
 */
export function absoluteUrl(path: string, marketKey: MarketKey): string {
  const market = MARKETS[marketKey];
  const safe = path.startsWith('/') ? path : `/${path}`;
  return `${market.baseUrl}${safe}`;
}
