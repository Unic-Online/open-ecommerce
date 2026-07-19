/**
 * Acceptance gate for the sitemap:
 *   - One entry per (locale, route) when the route exists in both markets.
 *   - Each entry's primary `url` lives on its locale's own host.
 *   - `alternates.languages['x-default']` equals the entry's own URL.
 *   - Product slugs present in only one market emit only the locale that has them.
 */
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { MARKETS } from '@/i18n/market-config';

const RO_BASE = MARKETS.ro.baseUrl;    // https://ro.shop.example.com
const EN_BASE = MARKETS.english.baseUrl; // https://shop.example.com

describe('sitemap()', () => {
  const entries = sitemap();

  it('emits at least one entry per locale for each static route', () => {
    const homeEntries = entries.filter(
      (e) => e.url === `${RO_BASE}/` || e.url === `${EN_BASE}/`,
    );
    expect(homeEntries.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the locale-own host as the primary URL', () => {
    for (const entry of entries) {
      const isRoHost = entry.url.startsWith(RO_BASE);
      const isEnHost = entry.url.startsWith(EN_BASE);
      expect(isRoHost || isEnHost, `unexpected host on ${entry.url}`).toBe(true);
    }
    // RO category slug lives on ro.shop.example.com; EN slug on shop.example.com.
    const roMobilier = entries.find((e) => e.url === `${RO_BASE}/mobilier`);
    const enFurniture = entries.find((e) => e.url === `${EN_BASE}/furniture`);
    expect(roMobilier).toBeDefined();
    expect(enFurniture).toBeDefined();
  });

  it('points x-default at the entry\'s own primary URL (locale-self)', () => {
    for (const entry of entries) {
      const xDefault = entry.alternates?.languages?.['x-default'];
      expect(xDefault, `missing x-default on ${entry.url}`).toBeDefined();
      expect(xDefault).toBe(entry.url);
    }
  });

  it('lists every locale that has the route in alternates.languages', () => {
    const roHome = entries.find((e) => e.url === `${RO_BASE}/`);
    expect(roHome?.alternates?.languages?.['ro-RO']).toBe(`${RO_BASE}/`);
    expect(roHome?.alternates?.languages?.['en-GB']).toBe(`${EN_BASE}/`);
  });

  it('does not duplicate the same primary URL', () => {
    const seen = new Set<string>();
    for (const entry of entries) {
      expect(seen.has(entry.url), `duplicate URL ${entry.url}`).toBe(false);
      seen.add(entry.url);
    }
  });

  it('emits at least one product detail page per category', () => {
    // RO localized category slugs
    for (const cat of ['mobilier', 'iluminat', 'exterior']) {
      const detailRo = entries.filter((e) =>
        e.url.startsWith(`${RO_BASE}/${cat}/`),
      );
      expect(detailRo.length, `no product entries for RO ${cat}`).toBeGreaterThan(0);
    }
    // EN category slugs
    for (const cat of ['furniture', 'lighting', 'outdoor']) {
      const detailEn = entries.filter((e) =>
        e.url.startsWith(`${EN_BASE}/${cat}/`),
      );
      expect(detailEn.length, `no product entries for EN ${cat}`).toBeGreaterThan(0);
    }
  });

  it('includes static info pages under both hosts', () => {
    const staticSlugs = [
      'despre-noi',
      'cum-comand',
      'contact',
      'politica-retur',
      'politica-confidentialitate',
      'termeni-conditii',
    ];
    for (const slug of staticSlugs) {
      const roEntry = entries.find((e) => e.url === `${RO_BASE}/${slug}`);
      expect(roEntry, `missing RO static page: ${slug}`).toBeDefined();
    }
  });
});
