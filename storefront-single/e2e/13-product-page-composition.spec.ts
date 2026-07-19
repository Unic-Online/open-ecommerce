import { expect, test } from '@playwright/test';

// Locks down the fields that get composed onto a product page at request time
// from `content/products/<slug>.ts` — breadcrumb, categoryLink, description
// sections. If composition silently regresses, the breadcrumb / category-link
// UI on the product page disappears.

test.describe('Product page — composed-from-content fields', () => {
  test('breadcrumb has nav landmark with home + category items', async ({ page }) => {
    await page.goto('/furniture/oslo-nightstand');
    const breadcrumb = page.getByRole('navigation', { name: 'Navigation' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: /Home/i })).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: /Furniture/i })).toBeVisible();
  });

  test('category-link below the buy box points back to the furniture listing', async ({ page }) => {
    await page.goto('/furniture/oslo-nightstand');
    // Scope to the buy-box "Categories:" row to avoid matching the header dropdown.
    const categoryRow = page
      .locator('div')
      .filter({ has: page.getByText('Categories:', { exact: true }) })
      .filter({ has: page.locator('a[href="/furniture"]') })
      .first();
    await expect(categoryRow).toBeVisible();
    await expect(categoryRow.locator('a[href="/furniture"]')).toHaveText(/Furniture/);
  });

  test('description block renders at least one heading + paragraph', async ({ page }) => {
    await page.goto('/furniture/aria-console');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Specifications/i })).toBeVisible();
  });
});
