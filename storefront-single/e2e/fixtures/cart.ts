import type { Page } from '@playwright/test';
// Pull the canonical per-market price list directly from the source of
// truth so the fixture cannot drift away from production catalog prices.
// CartProvider's anti-stale-pricing guard (cart-context.tsx:49-56) drops
// items whose stored unitPrice differs from the live market price.
// `prices.ts` derives from `content/products/*`, so the runtime import
// resolves cleanly without a path-alias config in the e2e runner.
import { productPrices } from '../../src/data/products/prices';

// A representative cart item shape. Mirrors src/lib/types.ts CartItemData.
// `productType` IS the category key (see cart-price-validator.ts) and the
// cart id is `${productType}__${slug}`.
export interface E2ECartItem {
  id: string;
  productType: 'furniture' | 'lighting' | 'outdoor';
  productName: string;
  quantity: number;
  image: string;
  unitPrice: number;
  slug: string;
  shortName: string;
}

// This is the single-language (English) template: there is exactly one
// commercial market (`main`, EUR). CartProvider's price guard validates the
// stored unitPrice against that market's catalog price, so the fixture must
// carry the live EUR price or the item is dropped on hydration.
const OSLO = productPrices['furniture__oslo-nightstand']?.main;
if (!OSLO) {
  throw new Error(
    'e2e fixture: furniture__oslo-nightstand missing from productPrices — keep this entry alive in content/products/oslo-nightstand.ts',
  );
}

/**
 * Sample cart item pinned to the Oslo Nightstand at the current EUR catalog
 * price (the single `main` market).
 */
export const SAMPLE_CART_ITEM: E2ECartItem = {
  id: 'furniture__oslo-nightstand',
  productType: 'furniture',
  productName: 'Oslo Nightstand',
  quantity: 1,
  image: '/images/oslo-nightstand/1.jpg',
  unitPrice: OSLO.price,
  slug: 'oslo-nightstand',
  shortName: 'Oslo Nightstand',
};

const CART_STORAGE_KEY = 'storefront-cart';

/**
 * Pre-populate localStorage with a cart before page load. Faster than
 * driving the add-to-cart UI when the test only cares about cart state.
 */
export async function seedCart(page: Page, items: E2ECartItem[]): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: CART_STORAGE_KEY, value: items },
  );
}

/**
 * Pre-accept (decline) GDPR consent so the cookie banner (which renders as
 * role="dialog") doesn't compete with our locators. Each Playwright test
 * already gets a fresh browser context with empty localStorage and cookies,
 * so we don't need to clear anything explicitly — and clearing via
 * addInitScript is actively harmful because it would also wipe legitimate
 * state on intra-test reloads.
 */
export async function clearCartStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'sf_consent_v1',
        JSON.stringify({
          version: '1',
          necessary: true,
          analytics: false,
          marketing: false,
          givenAt: new Date().toISOString(),
          source: 'banner_decline_all',
        }),
      );
    } catch {
      /* storage unavailable — fine */
    }
  });
}
