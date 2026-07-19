/**
 * Origin (`https://host`) resolution for outbound links.
 *
 * Magic-link URLs in transactional emails MUST point at the host where the
 * customer placed the order — not at the production market domain — so a
 * staging tester gets a staging link and a customer on one market's host never
 * gets another market's domain link.
 *
 *  - `originFromRequest` is for in-request paths (e.g. /api/order, the
 *    customer's POST). Honors `x-forwarded-host` / `x-forwarded-proto` so
 *    Vercel preview hosts resolve correctly behind their proxy.
 *  - `originFromOrder` is for out-of-band paths (Revolut webhook, admin
 *    fulfillment) where the customer is not on the wire. Reads the
 *    `domain` field persisted at order creation; falls back to the market
 *    base URL if the field is missing (legacy docs predate it).
 */
import { getMarketConfig, type MarketKey } from '@/i18n/market-config';

export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const proto = forwardedProto ?? 'https';
    return `${proto}://${forwardedHost}`;
  }
  return `${url.protocol}//${url.host}`;
}

export function originFromOrder(order: {
  domain?: string;
  market: MarketKey;
}): string {
  const host = order.domain?.trim();
  if (host) {
    // `domain` is stored as a bare host (e.g. `shop.example.com` or a Vercel
    // preview URL). Default to https — the only http hosts we ever see
    // are localhost during dev, and dev doesn't issue customer emails.
    const proto = host.startsWith('localhost') ? 'http' : 'https';
    return `${proto}://${host}`;
  }
  return getMarketConfig(order.market).baseUrl;
}
