import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '@/plugins/abandoned-cart/server/bot-guard';
import { MARKETS } from '@/i18n/market-config';

function withOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new Request('https://example.test/api/cart/sync', { method: 'POST', headers });
}

describe('isAllowedOrigin', () => {
  it('allows requests with no Origin header (same-origin POST)', () => {
    expect(isAllowedOrigin(withOrigin(null))).toBe(true);
  });

  it('allows every market primary domain', () => {
    for (const m of Object.values(MARKETS)) {
      expect(isAllowedOrigin(withOrigin(`https://${m.domain}`)), m.domain).toBe(true);
    }
  });

  it('allows every market domain alias', () => {
    for (const m of Object.values(MARKETS)) {
      for (const alias of m.domainAliases ?? []) {
        expect(isAllowedOrigin(withOrigin(`https://${alias}`)), alias).toBe(true);
      }
    }
  });

  it('allows subdomains of market primary domains', () => {
    expect(isAllowedOrigin(withOrigin('https://staging.shop.example.com'))).toBe(true);
    expect(isAllowedOrigin(withOrigin('https://www.ro.shop.example.com'))).toBe(true);
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
    expect(isAllowedOrigin(withOrigin('https://Ro.Shop.Example.Com'))).toBe(true);
  });
});
