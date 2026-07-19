import { expect, test } from '@playwright/test';

// Runs on the default (EN) storefront, so nav + search copy is English.

test.describe('Header search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const header = page.locator('header').first();
    await header.getByRole('button', { name: 'Open menu' }).click();
  });

  test('typing a query shows matching products and clears resets the list', async ({ page }) => {
    const drawer = page.locator('#mobile-drawer');
    const input = drawer.getByPlaceholder('Search products...');

    await input.fill('oslo');

    const results = drawer.locator('#header-search-results');
    await expect(results).toBeVisible();

    const links = results.getByRole('link');
    await expect(links.first()).toBeVisible();

    // Clear button resets the dropdown.
    await drawer.getByRole('button', { name: 'Clear search' }).click();
    await expect(results).toHaveCount(0);
  });

  test('clicking a result navigates to the product page', async ({ page }) => {
    const drawer = page.locator('#mobile-drawer');
    await drawer.getByPlaceholder('Search products...').fill('oslo');

    const results = drawer.locator('#header-search-results');
    await expect(results).toBeVisible();

    await results.getByRole('link').first().click();
    // Generous timeout: on a cold dev server the first compile of the
    // product route exceeds the default 5s.
    await expect(page).toHaveURL(/\/furniture\/oslo-nightstand\/?$/);
  });

  test('shows the no-results message for nonsense queries', async ({ page }) => {
    const drawer = page.locator('#mobile-drawer');
    await drawer.getByPlaceholder('Search products...').fill('zzzzqqqq');

    const results = drawer.locator('#header-search-results');
    await expect(results).toContainText('No products match');
  });
});

test.describe('Desktop header', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
  });

  test('search opens the desktop popover without opening the mobile drawer', async ({ page }) => {
    const header = page.locator('header').first();

    await header.getByRole('button', { name: 'Search' }).click();

    await expect(page.locator('#mobile-drawer')).toBeHidden();

    const desktopSearch = page.locator('#desktop-header-search');
    await expect(desktopSearch).toBeVisible();

    await desktopSearch.getByPlaceholder('Search products...').fill('oslo');
    await expect(desktopSearch.locator('#desktop-header-search-results')).toBeVisible();
  });

  test('desktop navigation includes the category and static links', async ({ page }) => {
    const nav = page.locator('#site-navigation');
    await expect(nav).toBeVisible();

    for (const label of ['Home', 'Furniture', 'Lighting', 'Outdoor', 'About us', 'Contact']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });
});
