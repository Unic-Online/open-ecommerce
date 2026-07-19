/**
 * Sanity guard for the locale + market product loader.
 *
 * Goals:
 *   - getProduct returns EN content with english-market price for oslo-nightstand
 *   - getProduct returns RO content with RO market price
 *   - getProduct returns null for an unknown slug
 *   - getCategoryProducts lists all products in a category for a given locale
 *   - shareUrl is built from absoluteUrl + localized path
 *   - per-product content parity between EN and RO (no missing keys, no
 *     empty strings, matching description / spec / gallery shapes)
 */
import { describe, expect, it } from 'vitest';
import { getProduct, getCategoryProducts, getContent } from '@/i18n/product';
import type { LocaleKey } from '@/i18n/locales';
import type {
  ProductCategory,
  ProductDescriptionSection,
  ProductGalleryImage,
} from '@/lib/product';

describe('getProduct', () => {
  it('returns EN content for oslo-nightstand with the english market price', () => {
    const p = getProduct({
      locale: 'en',
      market: 'english',
      category: 'furniture',
      slug: 'oslo-nightstand',
    });
    expect(p).not.toBeNull();
    expect(p!.shortName).toBe('Oslo Nightstand');
    expect(p!.fullTitle).toMatch(/Oslo Nightstand/);
    expect(p!.price).toBe(149);
    expect(p!.oldPrice).toBe(199);
    expect(p!.shareUrl).toBe('https://shop.example.com/furniture/oslo-nightstand');
  });

  it('returns RO content for oslo-nightstand with the RO market price', () => {
    const p = getProduct({
      locale: 'ro',
      market: 'ro',
      category: 'furniture',
      slug: 'oslo-nightstand',
    });
    expect(p).not.toBeNull();
    expect(p!.shortName).toBe('Noptiera Oslo');
    expect(p!.price).toBe(749);
    expect(p!.oldPrice).toBe(999);
    expect(p!.shareUrl).toBe('https://ro.shop.example.com/mobilier/oslo-nightstand');
  });

  it('returns null for an unknown slug', () => {
    const p = getProduct({
      locale: 'ro',
      market: 'ro',
      category: 'furniture',
      slug: 'does-not-exist',
    });
    expect(p).toBeNull();
  });

  it('returns null when content is missing for a locale', () => {
    const sentinel = getContent('en', 'furniture', 'never-shipping');
    expect(sentinel).toBeNull();
  });
});

describe('getCategoryProducts', () => {
  it('lists every EN furniture product', () => {
    const list = getCategoryProducts({ locale: 'en', market: 'english', category: 'furniture' });
    const slugs = list.map((p) => p.slug).sort();
    expect(slugs).toEqual(['aria-console', 'oslo-nightstand']);
  });

  it('lists every RO lighting product', () => {
    const list = getCategoryProducts({ locale: 'ro', market: 'ro', category: 'lighting' });
    const slugs = list.map((p) => p.slug).sort();
    expect(slugs).toEqual(['halo-table-lamp', 'lumen-floor-lamp']);
  });

  it('lists the outdoor product in EN', () => {
    const list = getCategoryProducts({ locale: 'en', market: 'english', category: 'outdoor' });
    const slugs = list.map((p) => p.slug).sort();
    expect(slugs).toEqual(['terra-path-light']);
  });
});

const ALL: Array<{ category: ProductCategory; slug: string }> = [
  { category: 'furniture', slug: 'oslo-nightstand' },
  { category: 'furniture', slug: 'aria-console' },
  { category: 'lighting', slug: 'halo-table-lamp' },
  { category: 'lighting', slug: 'lumen-floor-lamp' },
  { category: 'outdoor', slug: 'terra-path-light' },
];

function flattenContentKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    out.push(...flattenContentKeys(v, next));
  }
  return out;
}

describe('product content parity (EN vs RO)', () => {
  for (const { category, slug } of ALL) {
    it(`${category}/${slug}: EN and RO have the same key set`, () => {
      const en = getContent('en', category, slug);
      const ro = getContent('ro', category, slug);
      expect(en).not.toBeNull();
      expect(ro).not.toBeNull();
      const enKeys = flattenContentKeys(en!).sort();
      const roKeys = flattenContentKeys(ro!).sort();
      expect(roKeys).toEqual(enKeys);
    });

    it(`${category}/${slug}: gallery has the same length and same image src list`, () => {
      const en = getContent('en', category, slug)!;
      const ro = getContent('ro', category, slug)!;
      expect(ro.gallery.length).toBe(en.gallery.length);
      const enSrcs = en.gallery.map((g: ProductGalleryImage) => g.src);
      const roSrcs = ro.gallery.map((g: ProductGalleryImage) => g.src);
      expect(roSrcs).toEqual(enSrcs);
    });

    it(`${category}/${slug}: description sections match in length and kind`, () => {
      const en = getContent('en', category, slug)!;
      const ro = getContent('ro', category, slug)!;
      expect(ro.description.length).toBe(en.description.length);
      const enKinds = en.description.map((s: ProductDescriptionSection) => s.kind);
      const roKinds = ro.description.map((s: ProductDescriptionSection) => s.kind);
      expect(roKinds).toEqual(enKinds);
    });

    it(`${category}/${slug}: spec list lengths match across locales`, () => {
      const en = getContent('en', category, slug)!;
      const ro = getContent('ro', category, slug)!;
      const enSpecs = en.description
        .filter((s: ProductDescriptionSection) => s.kind === 'specList')
        .flatMap((s) => (s.kind === 'specList' ? s.specs : []));
      const roSpecs = ro.description
        .filter((s: ProductDescriptionSection) => s.kind === 'specList')
        .flatMap((s) => (s.kind === 'specList' ? s.specs : []));
      expect(roSpecs.length).toBe(enSpecs.length);
    });

    it(`${category}/${slug}: no EN string is empty`, () => {
      const en = getContent('en', category, slug)!;
      const empties: string[] = [];
      const walk = (v: unknown, prefix: string) => {
        if (typeof v === 'string') {
          if (v.trim() === '') empties.push(prefix);
        } else if (Array.isArray(v)) {
          v.forEach((item, i) => walk(item, `${prefix}[${i}]`));
        } else if (v && typeof v === 'object') {
          for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
            walk(vv, prefix ? `${prefix}.${k}` : k);
          }
        }
      };
      walk(en, '');
      expect(empties).toEqual([]);
    });
  }
});

describe('shareUrl composition', () => {
  it('uses the localized path on the correct market base URL', () => {
    const samples: Array<{
      locale: LocaleKey;
      market: 'ro' | 'english';
      category: ProductCategory;
      slug: string;
      expected: string;
    }> = [
      {
        locale: 'en',
        market: 'english',
        category: 'lighting',
        slug: 'halo-table-lamp',
        expected: 'https://shop.example.com/lighting/halo-table-lamp',
      },
      {
        locale: 'en',
        market: 'english',
        category: 'outdoor',
        slug: 'terra-path-light',
        expected: 'https://shop.example.com/outdoor/terra-path-light',
      },
      {
        locale: 'ro',
        market: 'ro',
        category: 'lighting',
        slug: 'halo-table-lamp',
        expected: 'https://ro.shop.example.com/iluminat/halo-table-lamp',
      },
      {
        locale: 'ro',
        market: 'ro',
        category: 'outdoor',
        slug: 'terra-path-light',
        expected: 'https://ro.shop.example.com/exterior/terra-path-light',
      },
    ];
    for (const s of samples) {
      const p = getProduct({
        locale: s.locale,
        market: s.market,
        category: s.category,
        slug: s.slug,
      });
      expect(p!.shareUrl).toBe(s.expected);
    }
  });
});
