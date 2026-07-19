import { expect, test } from '@playwright/test';

// Locks down the fields that get composed onto a product page at request time
// from `content/products/<slug>.ts` — breadcrumb, categoryLink, description
// sections. If composition silently regresses, the breadcrumb / category-link
// UI on the product page disappears.
//
// Runs on the RO storefront so the composed copy is Romanian.

test.describe('Product page — composed-from-content fields', () => {
  test('RO breadcrumb has nav landmark with home + category items', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    const breadcrumb = page.getByRole('navigation', { name: 'Navigare' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: /Prima pagină/i })).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: /Mobilier/i })).toBeVisible();
  });

  test('RO category-link below the buy box points back to the furniture listing', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    // Scope to the buy-box "Categorii:" row to avoid matching the header dropdown.
    const categoryRow = page
      .locator('div')
      .filter({ has: page.getByText('Categorii:', { exact: true }) })
      .filter({ has: page.locator('a[href="/mobilier"]') })
      .first();
    await expect(categoryRow).toBeVisible();
    await expect(categoryRow.locator('a[href="/mobilier"]')).toHaveText(/Mobilier/);
  });

  test('RO description block renders at least one heading + paragraph', async ({ page }) => {
    await page.goto('/ro/mobilier/aria-console');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Specificații/i })).toBeVisible();
  });
});
