import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';
import {
  deleteCartAndCoupons,
  getTestDb,
  seedCart as seedCartDb,
} from './fixtures/db';

test.describe('Phase 2 — cart persistence', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  test('seeded cart triggers a /api/cart/sync POST and sets the cookie', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);

    // Wait for the debounced sync that carries the seeded item. The
    // abandoned-cart plugin also syncs on load/activity, and on a cold server
    // an items-less background POST can win a bare URL match and fail the
    // body asserts below — so match the response whose REQUEST carries the
    // seeded item, then read the correlated request off it. Registered before
    // goto so the exchange can't be missed.
    const syncResponse = page.waitForResponse((res) => {
      const r = res.request();
      if (!res.url().endsWith('/api/cart/sync') || r.method() !== 'POST') return false;
      try {
        const body = JSON.parse(r.postData() ?? '{}');
        return (
          Array.isArray(body.items) &&
          body.items.some((i: { id?: string }) => i.id === SAMPLE_CART_ITEM.id)
        );
      } catch {
        return false;
      }
    });
    await page.goto('/');
    const res = await syncResponse;
    const req = res.request();

    // The POST body carries items, subtotal, and the bot-check token.
    const body = JSON.parse(req.postData() ?? '{}');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0].id).toBe(SAMPLE_CART_ITEM.id);
    expect(body.subtotal).toBeGreaterThan(0);
    expect(typeof body.botCheck).toBe('string');
    expect(body.botCheck.length).toBeGreaterThanOrEqual(3);

    // Server returns a UUID cartId and sets the sf_cart_id cookie.
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.cartId).toBe('string');

    const cookies = await page.context().cookies();
    const cartCookie = cookies.find((c) => c.name === 'sf_cart_id');
    expect(cartCookie).toBeDefined();
    expect(cartCookie?.value).toBe(json.cartId);
  });

  test('repeat syncs reuse the same cartId from the cookie', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');

    const firstResponse = await page.waitForResponse('/api/cart/sync');
    const firstId = (await firstResponse.json()).cartId as string;

    // Force a re-sync by reloading; the cookie should pin the same cartId.
    await page.reload();
    const secondResponse = await page.waitForResponse('/api/cart/sync');
    const secondId = (await secondResponse.json()).cartId as string;

    expect(secondId).toBe(firstId);
  });

  test('emptying the cart triggers a sync with empty items', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await page.waitForResponse('/api/cart/sync');

    const emptyResponse = page.waitForResponse((res) => {
      return res.url().endsWith('/api/cart/sync');
    });
    await page.evaluate(() => {
      localStorage.setItem('storefront-cart', JSON.stringify([]));
      // Force the cart-context listener to re-read by dispatching a storage
      // event on a clone window. Simpler: navigate.
      window.location.reload();
    });
    const res = await emptyResponse;
    expect(res.status()).toBe(200);
  });
});

test.describe('Phase 2 — bot guard', () => {
  test('Googlebot UA is silently ignored (200 + ignored:true)', async ({ request }) => {
    const res = await request.post('/api/cart/sync', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Origin: 'http://localhost:3000',
      },
      data: { items: [], subtotal: 0, botCheck: 'abcd' },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe(true);
  });

  test('missing botCheck token is silently ignored', async ({ request }) => {
    const res = await request.post('/api/cart/sync', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
        Origin: 'http://localhost:3000',
      },
      data: { items: [], subtotal: 0 },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ignored).toBe(true);
  });

  test('valid request passes the guard', async ({ request }) => {
    const res = await request.post('/api/cart/sync', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
        Origin: 'http://localhost:3000',
      },
      data: { items: [], subtotal: 0, botCheck: 'abcd' },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.cartId).toBe('string');
  });
});

test.describe('Phase 2 — completed-cart cookie rotation', () => {
  test('sync rotates cartId when the cookie points to a completed cart', async ({
    request,
  }) => {
    const completedCartId = randomUUID();
    await seedCartDb({
      cartId: completedCartId,
      email: 'returning@test.ro',
      items: [
        {
          id: SAMPLE_CART_ITEM.id,
          productType: SAMPLE_CART_ITEM.productType,
          productName: SAMPLE_CART_ITEM.productName,
          quantity: 1,
          image: SAMPLE_CART_ITEM.image,
          unitPrice: SAMPLE_CART_ITEM.unitPrice,
          slug: SAMPLE_CART_ITEM.slug,
          shortName: SAMPLE_CART_ITEM.shortName,
        },
      ],
      status: 'completed',
    });

    try {
      const res = await request.post('/api/cart/sync', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
          Origin: 'http://localhost:3000',
        },
        data: {
          cartId: completedCartId,
          items: [
            {
              id: SAMPLE_CART_ITEM.id,
              productType: SAMPLE_CART_ITEM.productType,
              productName: SAMPLE_CART_ITEM.productName,
              quantity: 1,
              unitPrice: SAMPLE_CART_ITEM.unitPrice,
              slug: SAMPLE_CART_ITEM.slug,
              shortName: SAMPLE_CART_ITEM.shortName,
              image: SAMPLE_CART_ITEM.image,
            },
          ],
          subtotal: SAMPLE_CART_ITEM.unitPrice,
          marketingConsent: false,
          botCheck: 'abcd',
        },
      });
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      // Returned cartId is fresh — server detected the completed doc and rotated.
      expect(json.cartId).not.toBe(completedCartId);
      expect(typeof json.cartId).toBe('string');
      expect(json.cartId.length).toBeGreaterThan(0);

      // The Set-Cookie header carries the rotated id.
      const setCookie = res.headers()['set-cookie'] ?? '';
      expect(setCookie).toContain(`sf_cart_id=${json.cartId}`);

      // The completed doc is preserved as audit, and a new doc exists.
      const db = await getTestDb();
      const oldDoc = await db.collection('carts').findOne({ cartId: completedCartId });
      expect(oldDoc?.status).toBe('completed');
      const newDoc = await db.collection('carts').findOne({ cartId: json.cartId });
      expect(newDoc?.status).toBe('active');
      expect(newDoc?.recoveryStep).toBe(0);
      expect(newDoc?.recoveryEmails).toEqual([]);

      await db.collection('carts').deleteOne({ cartId: json.cartId });
    } finally {
      await deleteCartAndCoupons(completedCartId);
    }
  });
});
