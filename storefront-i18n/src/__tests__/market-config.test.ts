import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MARKET,
  MARKETS,
  getHostMarketMap,
  getMarketConfig,
  getRoutingDomains,
} from '@/i18n/market-config';
import {
  absoluteUrl,
  resolveMarketFromHost,
} from '@/i18n/market-resolver';
import { routing } from '@/i18n/routing';

describe('resolveMarketFromHost', () => {
  it('maps ro.shop.example.com to the ro market', () => {
    expect(resolveMarketFromHost('ro.shop.example.com')).toBe('ro');
  });

  it('maps shop.example.com to the english market', () => {
    expect(resolveMarketFromHost('shop.example.com')).toBe('english');
    expect(resolveMarketFromHost('www.shop.example.com')).toBe('english');
  });

  it('maps localhost:3000 to the ro market (dev default)', () => {
    expect(resolveMarketFromHost('localhost:3000')).toBe('ro');
  });

  it('maps unknown preview hosts to DEFAULT_MARKET', () => {
    expect(resolveMarketFromHost('foo.vercel.app')).toBe(DEFAULT_MARKET);
  });

  it('falls back to DEFAULT_MARKET when host is null', () => {
    expect(resolveMarketFromHost(null)).toBe(DEFAULT_MARKET);
  });

  it('matches *.shop.example.com subdomains as english', () => {
    expect(resolveMarketFromHost('staging.shop.example.com')).toBe('english');
  });

  it('matches *.ro.shop.example.com subdomains as ro', () => {
    expect(resolveMarketFromHost('staging.ro.shop.example.com')).toBe('ro');
  });

  it('does NOT auto-map sibling subdomains under the parent domain to a market', () => {
    // `magazin.example.com` is a different project (not under a market's
    // *.shop.example.com host) — fall back to DEFAULT_MARKET.
    expect(resolveMarketFromHost('magazin.example.com')).toBe(DEFAULT_MARKET);
  });

  it('is case-insensitive', () => {
    expect(resolveMarketFromHost('RO.SHOP.EXAMPLE.COM')).toBe('ro');
    expect(resolveMarketFromHost('Shop.Example.COM')).toBe('english');
  });
});

describe('absoluteUrl', () => {
  it('joins a leading-slash path against the ro baseUrl', () => {
    expect(absoluteUrl('/mobilier/oslo-nightstand', 'ro')).toBe(
      'https://ro.shop.example.com/mobilier/oslo-nightstand',
    );
  });

  it('inserts a slash when the path lacks one', () => {
    expect(absoluteUrl('mobilier/oslo-nightstand', 'ro')).toBe(
      'https://ro.shop.example.com/mobilier/oslo-nightstand',
    );
  });

  it('uses the english market baseUrl', () => {
    expect(absoluteUrl('/furniture/oslo-nightstand', 'english')).toBe(
      'https://shop.example.com/furniture/oslo-nightstand',
    );
  });
});

describe('getMarketConfig', () => {
  it('returns the ro market with RON currency', () => {
    expect(getMarketConfig('ro').currency).toBe('RON');
  });

  it('returns the english market with EUR currency', () => {
    expect(getMarketConfig('english').currency).toBe('EUR');
  });

  it('enables english checkout in card-only mode', () => {
    expect(getMarketConfig('english').checkout.enabled).toBe(true);
    expect(getMarketConfig('english').checkout.paymentMethods).toEqual(['card']);
  });

  it('exposes english shipping at 10 EUR / 300 EUR free threshold', () => {
    expect(getMarketConfig('english').shipping.standardCost).toBe(10);
    expect(getMarketConfig('english').shipping.freeThreshold).toBe(300);
    expect(getMarketConfig('english').shipping.supportedCountries).toEqual(['GB']);
  });

  it('keeps ro checkout enabled with both ramburs and card', () => {
    expect(getMarketConfig('ro').checkout.enabled).toBe(true);
    expect(getMarketConfig('ro').checkout.paymentMethods).toEqual([
      'ramburs',
      'card',
    ]);
  });

  it('exposes ro shipping at 29 RON / 600 RON free threshold', () => {
    expect(getMarketConfig('ro').shipping.standardCost).toBe(29);
    expect(getMarketConfig('ro').shipping.freeThreshold).toBe(600);
    expect(getMarketConfig('ro').shipping.supportedCountries).toEqual(['RO']);
  });

  it('the MARKETS map carries the ro/english keys verbatim', () => {
    expect(MARKETS.ro.key).toBe('ro');
    expect(MARKETS.english.key).toBe('english');
  });

  it('DEFAULT_MARKET is english', () => {
    expect(DEFAULT_MARKET).toBe('english');
  });
});

describe('routing/market alignment (single source of truth)', () => {
  it('every MARKETS entry has a matching domain in next-intl routing', () => {
    const routingDomains = (routing.domains ?? []).map((d) => d.domain).sort();
    const marketDomains = Object.values(MARKETS).map((m) => m.domain).sort();
    expect(routingDomains).toEqual(marketDomains);
  });

  it('next-intl domain locale matches the market locale for each entry', () => {
    for (const m of Object.values(MARKETS)) {
      const routingEntry = routing.domains?.find((d) => d.domain === m.domain);
      expect(routingEntry).toBeDefined();
      expect(routingEntry!.defaultLocale).toBe(m.locale);
      expect(routingEntry!.locales).toEqual([m.locale]);
    }
  });

  it('getHostMarketMap covers primary domain and every alias', () => {
    const map = getHostMarketMap();
    for (const m of Object.values(MARKETS)) {
      expect(map[m.domain.toLowerCase()]).toBe(m.key);
      for (const alias of m.domainAliases ?? []) {
        expect(map[alias.toLowerCase()]).toBe(m.key);
      }
    }
  });

  it('getRoutingDomains exposes one entry per market', () => {
    expect(getRoutingDomains().length).toBe(Object.keys(MARKETS).length);
  });
});
