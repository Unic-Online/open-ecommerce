import { describe, expect, it } from 'vitest';
import { getDefinedProduct } from '@/../content/products';
import { toTemplateStub } from '@/lib/product-schema';
import {
  getCrossSell,
  getPopular,
  getUpsell,
} from '@/lib/related-products';

function stub(slug: string) {
  const defined = getDefinedProduct(slug);
  if (!defined) throw new Error(`getDefinedProduct returned null for "${slug}"`);
  return toTemplateStub(defined);
}

const osloNightstand = stub('oslo-nightstand');
const ariaConsole = stub('aria-console');
const haloTableLamp = stub('halo-table-lamp');
const lumenFloorLamp = stub('lumen-floor-lamp');
const terraPathLight = stub('terra-path-light');

describe('related-products helpers', () => {
  describe('getUpsell', () => {
    it('returns aria-console as upsell for oslo-nightstand (explicit upsellSlug)', () => {
      expect(getUpsell(osloNightstand)?.slug).toBe('aria-console');
    });

    it('returns null for aria-console (most expensive furniture, no upsell)', () => {
      expect(getUpsell(ariaConsole)).toBeNull();
    });

    it('returns lumen-floor-lamp as upsell for halo-table-lamp (explicit upsellSlug)', () => {
      expect(getUpsell(haloTableLamp)?.slug).toBe('lumen-floor-lamp');
    });

    it('returns null for lumen-floor-lamp (no upsell configured)', () => {
      expect(getUpsell(lumenFloorLamp)).toBeNull();
    });

    it('respects an explicit upsellSlug override', () => {
      const custom = { ...osloNightstand, upsellSlug: 'halo-table-lamp' };
      expect(getUpsell(custom)?.slug).toBe('halo-table-lamp');
    });

    it('returns null when the override slug does not exist', () => {
      const custom = { ...osloNightstand, upsellSlug: 'does-not-exist' };
      expect(getUpsell(custom)).toBeNull();
    });
  });

  describe('getCrossSell', () => {
    it('returns aria-console for oslo-nightstand (explicit crossSellSlugs)', () => {
      const cross = getCrossSell(osloNightstand).map((p) => p.slug);
      expect(cross).toEqual(['aria-console']);
    });

    it('returns oslo-nightstand for aria-console (explicit crossSellSlugs)', () => {
      const cross = getCrossSell(ariaConsole).map((p) => p.slug);
      expect(cross).toEqual(['oslo-nightstand']);
    });

    it('returns lumen-floor-lamp for halo-table-lamp', () => {
      const cross = getCrossSell(haloTableLamp).map((p) => p.slug);
      expect(cross).toEqual(['lumen-floor-lamp']);
    });

    it('returns halo-table-lamp for lumen-floor-lamp', () => {
      const cross = getCrossSell(lumenFloorLamp).map((p) => p.slug);
      expect(cross).toEqual(['halo-table-lamp']);
    });

    it('returns an empty list for terra-path-light (only outdoor product, no crossSellSlugs)', () => {
      expect(getCrossSell(terraPathLight)).toEqual([]);
    });

    it('respects crossSellSlugs override', () => {
      const custom = { ...osloNightstand, crossSellSlugs: ['halo-table-lamp'] };
      const cross = getCrossSell(custom).map((p) => p.slug);
      expect(cross).toEqual(['halo-table-lamp']);
    });

    it('drops unknown slugs from the override list', () => {
      const custom = { ...osloNightstand, crossSellSlugs: ['aria-console', 'unknown-x'] };
      expect(getCrossSell(custom).map((p) => p.slug)).toEqual(['aria-console']);
    });
  });

  describe('getPopular', () => {
    it('returns one product from each OTHER category for a furniture product', () => {
      const popular = getPopular(osloNightstand);
      const cats = popular.map((p) => p.category);
      expect(cats).toContain('lighting');
      expect(cats).toContain('outdoor');
      expect(cats).not.toContain('furniture');
    });

    it('returns products from OTHER categories for a lighting product', () => {
      // halo-table-lamp has popularSlugs: ['oslo-nightstand', 'aria-console'] — both furniture
      const popular = getPopular(haloTableLamp);
      const cats = popular.map((p) => p.category);
      expect(cats.length).toBeGreaterThan(0);
      expect(cats).not.toContain('lighting');
      // Both popular slugs are furniture
      expect(popular.map((p) => p.slug)).toEqual(['oslo-nightstand', 'aria-console']);
    });

    it('returns one product from each OTHER category for an outdoor product', () => {
      const popular = getPopular(terraPathLight);
      const cats = popular.map((p) => p.category);
      expect(cats).toContain('furniture');
      expect(cats).toContain('lighting');
      expect(cats).not.toContain('outdoor');
    });

    it('respects popularSlugs override', () => {
      const custom = { ...osloNightstand, popularSlugs: ['halo-table-lamp', 'terra-path-light'] };
      const popular = getPopular(custom);
      expect(popular.map((p) => p.slug)).toEqual(['halo-table-lamp', 'terra-path-light']);
    });

    it('drops unknown slugs from the override list', () => {
      const custom = { ...osloNightstand, popularSlugs: ['halo-table-lamp', 'gone-x'] };
      expect(getPopular(custom).map((p) => p.slug)).toEqual(['halo-table-lamp']);
    });
  });
});
