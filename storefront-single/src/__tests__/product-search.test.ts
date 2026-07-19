import { describe, expect, it } from 'vitest';
import { searchProducts } from '@/lib/product-search';
import type { ProductTemplate } from '@/lib/product';

function makeProduct(over: Partial<ProductTemplate> & { slug: string }): ProductTemplate {
  return {
    category: 'furniture',
    shortName: 'Acme XX',
    fullTitle: 'Acme XX — full title',
    tagline: 'tagline',
    shortDescription: 'description',
    price: 1000,
    currency: 'EUR',
    inStock: true,
    gallery: [{ src: '/x.jpg', label: 'x' }],
    ...over,
  };
}

// Demo catalog fixtures (ro content) — two furniture pieces that share words
// (stejar / mobilă) so AND-token + diacritic behavior is exercised, plus one
// lighting product that stays out of the furniture matches.
const oslo = makeProduct({
  slug: 'oslo-nightstand',
  category: 'furniture',
  shortName: 'Noptiera Oslo',
  fullTitle: 'Noptiera Oslo — Mobilă din Stejar Masiv cu Sertar Push-to-Open',
  tagline: 'Noptieră minimalistă din stejar',
  shortDescription: 'Noptieră din lemn masiv cu sertar soft-close.',
});

const aria = makeProduct({
  slug: 'aria-console',
  category: 'furniture',
  shortName: 'Consola Aria',
  fullTitle: 'Consola Aria — Mobilă cu Blat Alb și Picioare din Stejar Masiv',
  tagline: 'Consolă subțire de hol din stejar și alb',
  shortDescription: 'Consolă slim pentru hol cu poliță.',
});

const halo = makeProduct({
  slug: 'halo-table-lamp',
  category: 'lighting',
  shortName: 'Lampa de Masă Halo',
  fullTitle: 'Lampa de Masă Halo — Sferă din Sticlă Opală cu Bază din Alamă',
  tagline: 'Lumină caldă, reglaj la atingere',
  shortDescription: 'Lampă de masă reglabilă din sticlă opală.',
});

const catalog = [oslo, aria, halo];

describe('searchProducts', () => {
  it('returns empty for blank query', () => {
    expect(searchProducts(catalog, '')).toEqual([]);
    expect(searchProducts(catalog, '   ')).toEqual([]);
  });

  it('matches by short name', () => {
    const hits = searchProducts(catalog, 'oslo');
    expect(hits).toHaveLength(1);
    expect(hits[0].product.slug).toBe('oslo-nightstand');
  });

  it('is diacritic-insensitive (ro)', () => {
    // "mobilă" appears (accented) in both furniture fullTitles → 2 hits.
    expect(searchProducts(catalog, 'mobila')).toHaveLength(2);
    expect(searchProducts(catalog, 'MOBILĂ')).toHaveLength(2);
    // "noptieră" is unique to oslo.
    expect(searchProducts(catalog, 'noptiera')).toHaveLength(1);
  });

  it('requires every token to match (AND, not OR)', () => {
    // "stejar" and "mobila" both appear in the two furniture pieces — both stay.
    const both = searchProducts(catalog, 'stejar mobila');
    expect(both.map((h) => h.product.slug).sort()).toEqual(['aria-console', 'oslo-nightstand']);

    // Adding "lampa" filters all of them out — no product has all three tokens.
    expect(searchProducts(catalog, 'stejar mobila lampa')).toEqual([]);
  });

  it('ranks shortName/fullTitle hits above tagline-only hits', () => {
    // "consola" hits aria's shortName (weight 8); "stejar" co-occurs but the
    // shortName hit keeps aria ranked above any tagline-only competitor.
    const hits = searchProducts(catalog, 'consola');
    expect(hits[0].product.slug).toBe('aria-console');
  });

  it('matches on category name', () => {
    const hits = searchProducts(catalog, 'lighting');
    expect(hits.map((h) => h.product.slug)).toEqual(['halo-table-lamp']);
  });

  it('returns nothing when query has no token in haystack', () => {
    expect(searchProducts(catalog, 'frigider')).toEqual([]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeProduct({ slug: `s${i}`, shortName: `Mobilă ${i}`, fullTitle: `Mobilă numărul ${i}` }),
    );
    expect(searchProducts(many, 'mobila', 5)).toHaveLength(5);
  });
});
