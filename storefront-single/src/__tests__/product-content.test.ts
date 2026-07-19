/**
 * Sanity guard for the product catalog loader.
 *
 * Goals:
 *   - getProduct returns content with the correct price for oslo-nightstand
 *   - getProduct returns null for an unknown slug
 *   - getCategoryProducts lists all products in a category
 *   - shareUrl is built from absoluteUrl + product path
 *   - product content has no missing keys, no empty strings
 */
import { describe, expect, it } from 'vitest';
import { getProduct, getCategoryProducts, getContent } from '@/lib/catalog';
import type {
  ProductCategory,
  ProductDescriptionSection,
  ProductGalleryImage,
} from '@/lib/product';

describe('getProduct', () => {
  it('returns content for oslo-nightstand with the EUR price', () => {
    const p = getProduct({
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

  it('returns null for an unknown slug', () => {
    const p = getProduct({
      category: 'furniture',
      slug: 'does-not-exist',
    });
    expect(p).toBeNull();
  });

  it('returns null when content is missing for a slug', () => {
    const sentinel = getContent('furniture', 'never-shipping');
    expect(sentinel).toBeNull();
  });
});

describe('getCategoryProducts', () => {
  it('lists every furniture product', () => {
    const list = getCategoryProducts({ category: 'furniture' });
    const slugs = list.map((p) => p.slug).sort();
    expect(slugs).toEqual(['aria-console', 'oslo-nightstand']);
  });

  it('lists every lighting product', () => {
    const list = getCategoryProducts({ category: 'lighting' });
    const slugs = list.map((p) => p.slug).sort();
    expect(slugs).toEqual(['halo-table-lamp', 'lumen-floor-lamp']);
  });

  it('lists the outdoor product', () => {
    const list = getCategoryProducts({ category: 'outdoor' });
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

describe('product content validation', () => {
  for (const { category, slug } of ALL) {
    it(`${category}/${slug}: content loads and has required fields`, () => {
      const content = getContent(category, slug);
      expect(content).not.toBeNull();
      expect(content!.gallery.length).toBeGreaterThan(0);
      expect(content!.description.length).toBeGreaterThan(0);
    });

    it(`${category}/${slug}: gallery images have src and label`, () => {
      const content = getContent(category, slug)!;
      for (const img of content.gallery as ProductGalleryImage[]) {
        expect(img.src).toBeTruthy();
        expect(img.label).toBeTruthy();
      }
    });

    it(`${category}/${slug}: description sections have a kind`, () => {
      const content = getContent(category, slug)!;
      for (const section of content.description as ProductDescriptionSection[]) {
        expect(section.kind).toBeTruthy();
      }
    });

    it(`${category}/${slug}: no content string is empty`, () => {
      const content = getContent(category, slug)!;
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
      walk(content, '');
      expect(empties).toEqual([]);
    });
  }
});

describe('shareUrl composition', () => {
  it('uses the product path on the correct base URL', () => {
    const samples: Array<{
      category: ProductCategory;
      slug: string;
      expected: string;
    }> = [
      {
        category: 'lighting',
        slug: 'halo-table-lamp',
        expected: 'https://shop.example.com/lighting/halo-table-lamp',
      },
      {
        category: 'outdoor',
        slug: 'terra-path-light',
        expected: 'https://shop.example.com/outdoor/terra-path-light',
      },
    ];
    for (const s of samples) {
      const p = getProduct({ category: s.category, slug: s.slug });
      expect(p!.shareUrl).toBe(s.expected);
    }
  });
});
