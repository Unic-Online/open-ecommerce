/**
 * Issue #2 — internal product-page links must do client-side soft navigation
 * (no full page reload, no browser loading bar).
 *
 * Detection: tag `window` with a unique marker BEFORE clicking, click the
 * link, then re-read the marker. A full page reload wipes window state, so
 * a missing marker means the navigation was hard. A preserved marker means
 * the navigation was soft (next/link Link transitioning the route in-place).
 *
 * Note: next-intl localizes link hrefs but navigates client-side to the
 * canonical (en) pathname, so the destination URL is `/furniture` even when
 * starting from `/ro/mobilier/...`. The soft-nav contract (window sentinel
 * survives) is what this spec actually guards.
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
    await page.goto('/ro/mobilier/oslo-nightstand');
    await expect(page.locator('h1').first()).toBeVisible();

    await tagWindow(page);

    // The breadcrumb has "Prima pagină" → / and "Mobilier" → the listing.
    // Click the category link and assert no reload happened.
    const breadcrumbNav = page.getByRole('navigation').first();
    await breadcrumbNav.getByRole('link', { name: 'Mobilier' }).click();

    await expect(page).toHaveURL(/\/(furniture|mobilier)$/);

    const sentinel = await readSentinel(page);
    expect(sentinel, 'window sentinel was wiped — full page reload happened').toBe('1');
  });

  test('category link in product buy box navigates without full reload', async ({ page }) => {
    await page.goto('/ro/mobilier/aria-console');
    await expect(page.locator('h1').first()).toBeVisible();

    await tagWindow(page);

    // The buy-box category row also has a "Mobilier" link. Anchor on the
    // "Categorii" label as the section marker.
    const categoryLabel = page.getByText('Categorii').first();
    await expect(categoryLabel).toBeVisible();

    // Click the buy-box link whose text is exactly "Mobilier" and whose href
    // is "/mobilier" — disambiguates from the breadcrumb.
    const buyBoxCategoryLink = page
      .locator('a[href="/mobilier"]')
      .filter({ hasText: /^Mobilier$/ })
      .last();
    await buyBoxCategoryLink.click();

    await expect(page).toHaveURL(/\/(furniture|mobilier)$/);

    const sentinel = await readSentinel(page);
    expect(sentinel, 'window sentinel was wiped — full page reload happened').toBe('1');
  });
});
