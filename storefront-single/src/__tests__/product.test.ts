import { describe, expect, it } from 'vitest';
import { getProduct } from '@/lib/catalog';
import { getProductPrimaryDimension, getProductWeight } from '@/lib/product';

function composedProduct(
  category: 'furniture' | 'lighting' | 'outdoor',
  slug: string,
) {
  const product = getProduct({ category, slug });
  if (!product) throw new Error(`getProduct returned null for ${category}/${slug}`);
  return product;
}

describe('getProductPrimaryDimension', () => {
  it('reads dimensions for oslo-nightstand', () => {
    expect(
      getProductPrimaryDimension(composedProduct('furniture', 'oslo-nightstand')),
    ).toEqual({
      label: 'Dimensions',
      value: '45 × 40 × 42 cm (W × D × H)',
    });
  });

  it('reads dimensions for aria-console', () => {
    expect(
      getProductPrimaryDimension(composedProduct('furniture', 'aria-console')),
    ).toEqual({
      label: 'Dimensions',
      value: '110 × 30 × 80 cm (W × D × H)',
    });
  });
});

describe('getProductWeight', () => {
  it('reads the oslo-nightstand weight from specs', () => {
    expect(
      getProductWeight(composedProduct('furniture', 'oslo-nightstand')),
    ).toEqual({
      label: 'Weight',
      value: '9.5 kg',
    });
  });
});
