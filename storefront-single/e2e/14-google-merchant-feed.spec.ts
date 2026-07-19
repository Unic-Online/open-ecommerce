import { expect, test } from '@playwright/test';

// Locks the public Google Merchant feed shape. The single-language template
// serves one `main` market (EUR prices, shop.example.com domain, GB shipping).
// The feed composes from the unified product registry in content/products/*.

test.describe('Google Merchant feed', () => {
  test('returns 200 XML at /google-merchant.xml', async ({ request }) => {
    const res = await request.get('/google-merchant.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/xml/);
    const body = await res.text();
    expect(body.startsWith('<?xml')).toBe(true);
    expect(body).toContain('<rss');
    expect(body).toContain('<channel>');
    expect(body).toContain('</channel>');
  });

  test('includes every product in the catalog', async ({ request }) => {
    const body = await (await request.get('/google-merchant.xml')).text();
    const expectedIds = [
      'furniture_oslo-nightstand',
      'furniture_aria-console',
      'lighting_halo-table-lamp',
      'lighting_lumen-floor-lamp',
      'outdoor_terra-path-light',
    ];
    for (const id of expectedIds) {
      expect(body, `feed must contain <g:id>${id}</g:id>`).toContain(`<g:id>${id}</g:id>`);
    }
    const itemMatches = body.match(/<item>/g) ?? [];
    expect(itemMatches.length).toBe(expectedIds.length);
  });

  test('every item has the required Google Merchant fields', async ({ request }) => {
    const body = await (await request.get('/google-merchant.xml')).text();
    const items = body.split('<item>').slice(1);
    for (const item of items) {
      expect(item).toMatch(/<g:id>[^<]+<\/g:id>/);
      expect(item).toMatch(/<g:title>[^<]+<\/g:title>/);
      expect(item).toMatch(/<g:description>[^<]+<\/g:description>/);
      expect(item).toMatch(/<g:link>https:\/\/[^<]+<\/g:link>/);
      expect(item).toMatch(/<g:image_link>https:\/\/[^<]+<\/g:image_link>/);
      expect(item).toMatch(/<g:price>[\d.]+ EUR<\/g:price>/);
      expect(item).toMatch(/<g:availability>(in_stock|out_of_stock|preorder|backorder)<\/g:availability>/);
      expect(item).toMatch(/<g:condition>new<\/g:condition>/);
      expect(item).toMatch(/<g:brand>Acme Store<\/g:brand>/);
      expect(item).toMatch(/<g:product_type>(furniture|lighting|outdoor)<\/g:product_type>/);
      expect(item).toMatch(/<g:shipping>[\s\S]*<g:country>GB<\/g:country>[\s\S]*<\/g:shipping>/);
    }
  });

  test('a discounted product (oldPrice > price) emits sale_price', async ({
    request,
  }) => {
    const body = await (await request.get('/google-merchant.xml')).text();
    // oslo-nightstand: price 149 EUR, oldPrice 199 EUR → price=oldPrice,
    // sale_price=current.
    const block = body
      .split('<item>')
      .find((b) => b.includes('<g:id>furniture_oslo-nightstand</g:id>'));
    expect(block).toBeDefined();
    expect(block!).toContain('<g:price>199.00 EUR</g:price>');
    expect(block!).toContain('<g:sale_price>149.00 EUR</g:sale_price>');
    expect(block!).toContain('<g:availability>in_stock</g:availability>');
  });

  test('a product without oldPrice has no sale_price', async ({ request }) => {
    const body = await (await request.get('/google-merchant.xml')).text();
    // lumen-floor-lamp has no oldPrice, so no sale_price line.
    const block = body
      .split('<item>')
      .find((b) => b.includes('<g:id>lighting_lumen-floor-lamp</g:id>'));
    expect(block).toBeDefined();
    expect(block!).not.toContain('<g:sale_price>');
  });

  test('product titles use the catalog content copy', async ({ request }) => {
    const body = await (await request.get('/google-merchant.xml')).text();
    expect(body).toMatch(/<g:title>[^<]*Oslo[^<]*<\/g:title>/);
    expect(body).toMatch(/<g:title>[^<]*Nightstand[^<]*<\/g:title>/);
  });

  test('image links are absolute URLs on the market domain', async ({ request }) => {
    const body = await (await request.get('/google-merchant.xml')).text();
    const links = [...body.matchAll(/<g:image_link>([^<]+)<\/g:image_link>/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const url of links) {
      expect(url).toMatch(/^https:\/\/shop\.example\.com\/images\//);
    }
  });
});
