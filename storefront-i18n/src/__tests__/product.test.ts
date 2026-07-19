import { describe, expect, it } from 'vitest';
import { getProduct } from '@/i18n/product';
import { getProductPrimaryDimension, getProductWeight } from '@/lib/product';

function composedProduct(
  locale: 'en' | 'ro',
  market: 'english' | 'ro',
  category: 'furniture' | 'lighting' | 'outdoor',
  slug: string,
) {
  const product = getProduct({ locale, market, category, slug });
  if (!product) throw new Error(`getProduct returned null for ${category}/${slug}`);
  return product;
}

describe('getProductPrimaryDimension', () => {
  it('reads dimensions for oslo-nightstand (EN)', () => {
    expect(
      getProductPrimaryDimension(composedProduct('en', 'english', 'furniture', 'oslo-nightstand')),
    ).toEqual({
      label: 'Dimensions',
      value: '45 × 40 × 42 cm (W × D × H)',
    });
  });

  it('reads dimensions for oslo-nightstand (RO)', () => {
    expect(
      getProductPrimaryDimension(composedProduct('ro', 'ro', 'furniture', 'oslo-nightstand')),
    ).toEqual({
      label: 'Dimensiuni',
      value: '45 × 40 × 42 cm (L × A × Î)',
    });
  });

  it('reads dimensions for aria-console (EN)', () => {
    expect(
      getProductPrimaryDimension(composedProduct('en', 'english', 'furniture', 'aria-console')),
    ).toEqual({
      label: 'Dimensions',
      value: '110 × 30 × 80 cm (W × D × H)',
    });
  });
});

describe('getProductWeight', () => {
  it('reads the EN oslo-nightstand weight from specs', () => {
    expect(
      getProductWeight(composedProduct('en', 'english', 'furniture', 'oslo-nightstand')),
    ).toEqual({
      label: 'Weight',
      value: '9.5 kg',
    });
  });

  it('reads the RO oslo-nightstand weight from specs', () => {
    expect(
      getProductWeight(composedProduct('ro', 'ro', 'furniture', 'oslo-nightstand')),
    ).toEqual({
      label: 'Greutate',
      value: '9,5 kg',
    });
  });
});
