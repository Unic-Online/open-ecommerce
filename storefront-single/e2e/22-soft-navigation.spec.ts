/**
 * Issue #2 — internal product-page links must do client-side soft navigation
 * (no full page reload, no browser loading bar).
 *
 * Detection: tag `window` with a unique marker BEFORE clicking, click the
 * link, then re-read the marker. A full page reload wipes window state, so
 * a missing marker means the navigation was hard. A preserved marker means
 * the navigation was soft (next/link Link transitioning the route in-place).
 */
import { expect, test } from '@playwright/test';
import { clearCartStorage } from './fixtures/cart';

const SENTINEL = '__sf_soft_nav_sentinel__';

async function tagWindow(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate((key) => {
    (window as unknown as Record<string, unknown>)[key] = '1';
  }, SENTINEL);
}

async function readSentinel(page: import('@playwright/test').Page): Promise<string | undefined> {
  return page.evaluate(
    (key) => (window as unknown as Record<string, unknown>)[key] as string | undefined,
    SENTINEL,
  );
}

test.describe('#2 — soft navigation on internal product links', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-seed consent: on slow runners the cookie dialog can mount in the
    // middle of a click sequence and swallow the interaction entirely.
    await clearCartStorage(page);
  });

  test('breadcrumb on product page navigates without full reload', async ({ page }) => {
    await page.goto('/furniture/oslo-nightstand');
    await expect(page.locator('h1').first()).toBeVisible();

    await tagWindow(page);

    // The breadcrumb has "Home" → / and "Furniture" → the listing.
    // Click the category link and assert no reload happened.
    const breadcrumbNav = page.getByRole('navigation').first();
    await breadcrumbNav.getByRole('link', { name: 'Furniture' }).click();

    await expect(page).toHaveURL(/\/furniture$/);

    const sentinel = await readSentinel(page);
    expect(sentinel, 'window sentinel was wiped — full page reload happened').toBe('1');
  });

  test('category link in product buy box navigates without full reload', async ({ page }) => {
    await page.goto('/furniture/aria-console');
    await expect(page.locator('h1').first()).toBeVisible();

    await tagWindow(page);

    // The buy-box category row also has a "Furniture" link. Anchor on the
    // "Categories" label as the section marker.
    const categoryLabel = page.getByText('Categories').first();
    await expect(categoryLabel).toBeVisible();

    // Click the buy-box link whose text is exactly "Furniture" and whose href
    // is "/furniture" — disambiguates from the breadcrumb.
    const buyBoxCategoryLink = page
      .locator('a[href="/furniture"]')
      .filter({ hasText: /^Furniture$/ })
      .last();
    await buyBoxCategoryLink.click();

    await expect(page).toHaveURL(/\/furniture$/);

    const sentinel = await readSentinel(page);
    expect(sentinel, 'window sentinel was wiped — full page reload happened').toBe('1');
  });
});
