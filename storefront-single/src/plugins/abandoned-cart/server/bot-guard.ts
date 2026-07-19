// Anti-bot layer for /api/cart/sync (and any other endpoint that wants it).
//
// Three layers:
//   1. UA blacklist — known bots are ignored silently.
//   2. Origin check — POSTs from unknown origins are dropped. Allowed hosts
//      come from the single MARKET config (primary domain + aliases).
//   3. botCheck field — the client emits a base64 token in the body. Bots
//      without JS won't produce it, so missing/invalid token = silently
//      ignored. Server doesn't decode the value; presence is the signal.
//
// Convention: bot-guarded endpoints return 200 on bot detection so the bot
// doesn't learn it's been filtered. The cart upsert is skipped, but the
// request looks like it succeeded.
import { MARKET } from '@/lib/market';

const BOT_UA_PATTERNS: RegExp[] = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /scrape/i,
  // `/preview/i` was here historically; dropped because real Chrome canary
  // and corporate browsers occasionally include "Preview" in their UA.
  // The other patterns already catch the actual headless/scraper hits.
  /headlesschrome/i,
  /phantomjs/i,
  /slurp/i,
  /facebookexternalhit/i,
  /python-requests/i,
  /curl\//i,
  /wget/i,
  /go-http-client/i,
  /node-fetch/i,
  /postmanruntime/i,
  /storebot/i,
  /lighthouse/i,
];

// Derived once at module load. Includes the single market's primary domain
// plus every alias, lowercased. The `endsWith` checks below cover same-host
// subdomains (e.g. `staging.shop.example.com`).
const MARKET_ROOT_HOSTS: string[] = (() => {
  const set = new Set<string>();
  set.add(MARKET.domain.toLowerCase());
  return Array.from(set);
})();

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 4) return true;
  return BOT_UA_PATTERNS.some((re) => re.test(ua));
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  // Some browsers omit Origin on same-origin POST. Allow that path through —
  // the UA + botCheck gates still protect us.
  if (!origin) return true;
  try {
    const host = new URL(origin).host.toLowerCase();
    // Production market domains and their aliases.
    for (const root of MARKET_ROOT_HOSTS) {
      if (host === root || host.endsWith(`.${root}`)) return true;
    }
    // Add a separate marketing/blog apex here if you run one outside the market domain
    // (e.g. `if (host === 'blog.yourbrand.com') return true;`) so visitors
    // arriving from it can sync their carts. The demo ships without one.
    if (host.startsWith('localhost')) return true;
    if (host.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

export interface BotCheckResult {
  isBot: boolean;
  reason?: 'ua' | 'origin' | 'no-bot-check';
}

/**
 * Run all three gates against an incoming request. The body should already
 * be a parsed JSON object — this checks for a `botCheck` string field.
 */
export function botGuard(request: Request, body: unknown): BotCheckResult {
  if (isBotUserAgent(request.headers.get('user-agent'))) {
    return { isBot: true, reason: 'ua' };
  }
  if (!isAllowedOrigin(request)) {
    return { isBot: true, reason: 'origin' };
  }
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.botCheck !== 'string' || b.botCheck.length < 3) {
      return { isBot: true, reason: 'no-bot-check' };
    }
  } else {
    return { isBot: true, reason: 'no-bot-check' };
  }
  return { isBot: false };
}

export function extractClientIp(headers: Headers): string | undefined {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? undefined;
}
