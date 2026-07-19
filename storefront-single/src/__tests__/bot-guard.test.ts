import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '@/plugins/abandoned-cart/server/bot-guard';
import { MARKET } from '@/lib/market';

function withOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new Request('https://example.test/api/cart/sync', { method: 'POST', headers });
}

describe('isAllowedOrigin', () => {
  it('allows requests with no Origin header (same-origin POST)', () => {
    expect(isAllowedOrigin(withOrigin(null))).toBe(true);
  });

  it('allows the market primary domain', () => {
    expect(isAllowedOrigin(withOrigin(`https://${MARKET.domain}`)), MARKET.domain).toBe(true);
  });

  it('allows staging subdomain of market primary domain', () => {
    // domainAliases are not configured in the single-market template;
    // subdomains of the primary domain are covered by the subdomain test.
    expect(isAllowedOrigin(withOrigin(`https://staging.${MARKET.domain}`))).toBe(true);
  });

  it('allows subdomains of market primary domains', () => {
    expect(isAllowedOrigin(withOrigin('https://staging.shop.example.com'))).toBe(true);
  });

  it('does not blanket-allow the parent apex (no marketing domain configured)', () => {
    // The demo ships without a separate marketing/blog apex, so a bare
    // `example.com` (not a market host) is NOT allowed. Operators add their
    // own apex in bot-guard.ts when they run one.
    expect(isAllowedOrigin(withOrigin('https://example.com'))).toBe(false);
    expect(isAllowedOrigin(withOrigin('https://blog.example.com'))).toBe(false);
  });

  it('allows localhost and Vercel preview hosts', () => {
    expect(isAllowedOrigin(withOrigin('http://localhost:3000'))).toBe(true);
    expect(isAllowedOrigin(withOrigin('https://feature-x.vercel.app'))).toBe(true);
  });

  it('rejects unrelated hosts', () => {
    expect(isAllowedOrigin(withOrigin('https://attacker.example'))).toBe(false);
    // Suffix-spoofing: a host that merely *ends* with the brand label but on a
    // different apex must be rejected.
    expect(isAllowedOrigin(withOrigin('https://shop-example.com.evil.net'))).toBe(false);
  });

  it('rejects malformed Origin headers', () => {
    expect(isAllowedOrigin(withOrigin('not a url'))).toBe(false);
  });

  it('is case-insensitive on the host', () => {
    expect(isAllowedOrigin(withOrigin('https://WWW.SHOP.EXAMPLE.COM'))).toBe(true);
  });
});
