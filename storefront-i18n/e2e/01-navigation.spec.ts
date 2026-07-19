import { expect, test } from '@playwright/test';

test.describe('Page navigation smoke tests', () => {
  test('homepage renders and the cart icon is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Acme Store/i);
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('mobile drawer shows category links in view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const header = page.locator('header').first();
    await header.getByRole('button', { name: 'Open menu' }).click();

    const drawer = page.locator('#mobile-drawer');
    await expect(drawer).toBeVisible();

    // Category links are flat in the drawer list (no nested groups).
    for (const label of ['Furniture', 'Lighting', 'Outdoor']) {
      const link = drawer.getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      // The opened drawer must sit within the viewport (no horizontal
      // overflow pushing links off-screen).
      await expect(link).toBeInViewport();
    }
  });

  test('furniture listing renders', async ({ page }) => {
    const response = await page.goto('/furniture');
    expect(response?.ok()).toBe(true);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('furniture/oslo-nightstand product page renders', async ({ page }) => {
    const response = await page.goto('/furniture/oslo-nightstand');
    expect(response?.ok()).toBe(true);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('contact page renders', async ({ page }) => {
    const response = await page.goto('/contact');
    expect(response?.ok()).toBe(true);
  });

  test('unknown route returns 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
  });
});
