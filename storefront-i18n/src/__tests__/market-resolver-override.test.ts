import { describe, expect, it } from 'vitest';
import { resolveMarketFromRequest } from '@/i18n/market-resolver';

// The `__market` query/cookie override is a dev/QA escape hatch for preview
// hosts ONLY ("Production traffic is host-routed" — the resolver's own
// docstring). A money-path request on a production host must IGNORE the
// override — otherwise any customer can force a foreign market on /api/order
// or /api/payments/revolut/create-order (e.g. re-enable cash-on-delivery on a
// card-only market, or buy at another market's price table) with a query param.

function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe('resolveMarketFromRequest — production hosts are host-routed only', () => {
  it('ignores ?__market on the RO production host', () => {
    const req = makeRequest('https://ro.shop.example.com/api/order?__market=english', {
      host: 'ro.shop.example.com',
    });
    expect(resolveMarketFromRequest(req)).toBe('ro');
  });

  it('ignores ?__market on the EN production host (card-only gate stays intact)', () => {
    const req = makeRequest('https://shop.example.com/api/order?__market=ro', {
      host: 'shop.example.com',
    });
    expect(resolveMarketFromRequest(req)).toBe('english');
  });

  it('ignores the override cookie on a production host', () => {
    const req = makeRequest('https://ro.shop.example.com/api/payments/revolut/create-order', {
      host: 'ro.shop.example.com',
      cookie: 'sf_market_override=english; other=1',
    });
    expect(resolveMarketFromRequest(req)).toBe('ro');
  });

  it('ignores the override on a subdomain of a production domain', () => {
    const req = makeRequest('https://staging.shop.example.com/api/order?__market=ro', {
      host: 'staging.shop.example.com',
    });
    expect(resolveMarketFromRequest(req)).toBe('english');
  });
});

describe('resolveMarketFromRequest — QA escape hatch keeps working off-production', () => {
  it('honors ?__market on a Vercel preview host', () => {
    const req = makeRequest('https://storefront-git-staging.vercel.app/?__market=ro', {
      host: 'storefront-git-staging.vercel.app',
    });
    expect(resolveMarketFromRequest(req)).toBe('ro');
  });

  it('honors the override cookie on localhost', () => {
    const req = makeRequest('http://localhost:3000/api/order', {
      host: 'localhost:3000',
      cookie: 'sf_market_override=english',
    });
    expect(resolveMarketFromRequest(req)).toBe('english');
  });

  it('falls back to the default market on unknown hosts without an override', () => {
    const req = makeRequest('https://random-preview.vercel.app/api/order', {
      host: 'random-preview.vercel.app',
    });
    expect(resolveMarketFromRequest(req)).toBe('english');
  });
});
