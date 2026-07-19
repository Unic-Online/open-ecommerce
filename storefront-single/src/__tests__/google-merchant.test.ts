import { describe, expect, it } from 'vitest';
import { generateGoogleMerchantFeed, getMerchantProducts } from '@/lib/google-merchant';

describe('Google Merchant feed — main market', () => {
  it('includes all catalog products as Google Merchant items', () => {
    const products = getMerchantProducts();
    const feed = generateGoogleMerchantFeed(products, new Date('2026-05-03T10:00:00.000Z'));

    expect(feed).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect((feed.match(/<item>/g) ?? []).length).toBe(products.length);
    // All 5 demo products should appear
    expect(products.length).toBe(5);

    // g:id format: category_slug
    expect(feed).toContain('<g:id>furniture_oslo-nightstand</g:id>');
    expect(feed).toContain('<g:id>furniture_aria-console</g:id>');
    expect(feed).toContain('<g:id>lighting_halo-table-lamp</g:id>');
    expect(feed).toContain('<g:id>lighting_lumen-floor-lamp</g:id>');
    expect(feed).toContain('<g:id>outdoor_terra-path-light</g:id>');

    // g:brand is market name
    expect(feed).toContain('<g:brand>Acme Store</g:brand>');

    // g:product_type is the category key
    expect(feed).toContain('<g:product_type>furniture</g:product_type>');
    expect(feed).toContain('<g:product_type>lighting</g:product_type>');
    expect(feed).toContain('<g:product_type>outdoor</g:product_type>');

    // EUR prices: oslo-nightstand oldPrice=199, price=149
    expect(feed).toContain('<g:price>199.00 EUR</g:price>');
    expect(feed).toContain('<g:sale_price>149.00 EUR</g:sale_price>');

    // lumen-floor-lamp has no oldPrice → price only, no sale_price element for it
    expect(feed).toContain('<g:price>159.00 EUR</g:price>');

    // terra-path-light: oldPrice=89, price=69
    expect(feed).toContain('<g:price>89.00 EUR</g:price>');
    expect(feed).toContain('<g:sale_price>69.00 EUR</g:sale_price>');

    // Shipping element present
    expect(feed).toContain('<g:shipping>');
    // All products are inStock
    expect(feed).not.toContain('<g:availability>preorder</g:availability>');
    expect(feed).not.toContain('<g:availability>out_of_stock</g:availability>');
    expect(feed).toContain('<g:availability>in_stock</g:availability>');
  });
});
