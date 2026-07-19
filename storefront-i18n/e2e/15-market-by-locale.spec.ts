import { expect, test } from '@playwright/test';

// Locks the contract that the URL locale segment fully determines the
// commercial market (getMarketForLocale) — so storefront pages can be
// statically rendered without reading the request host. en → english market
// (EUR), ro → ro market (RON). If a future change reintroduces host-based
// market resolution on these pages, the currency tag would flip and these
// assertions would catch it.

test.describe('Locale determines market (ISR safety)', () => {
  test('RO product page renders RON prices', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    const priceArea = page.getByTestId('product-price');
    await expect(priceArea).toBeVisible();
    // Sale price + old price are both tagged in RON.
    await expect(priceArea.getByText(/\bRON\b/)).toHaveCount(2);
    await expect(priceArea.getByText(/749/).first()).toBeVisible();
  });

  test('EN product page renders EUR prices, never RON', async ({ page }) => {
    // The english storefront must show EUR prices and never leak the RON
    // catalog value. The architectural failure mode: locale=en but market=ro
    // (host fallback) → RON prices leak onto EN pages with the wrong currency.
    await page.goto('/furniture/oslo-nightstand');
    await expect(page.locator('h1').first()).toBeVisible();
    const priceArea = page.getByTestId('product-price');
    await expect(priceArea).toBeVisible();
    await expect(priceArea.getByText(/lei/i)).toHaveCount(0);
    await expect(priceArea.getByText(/RON/i)).toHaveCount(0);
    await expect(priceArea.getByText(/749/)).toHaveCount(0);
    await expect(priceArea.getByText(/€/).first()).toBeVisible();
  });

  test('RO listing page renders RON prices', async ({ page }) => {
    await page.goto('/ro/mobilier');
    await expect(page.getByText(/\bRON\b/).first()).toBeVisible();
  });

  test('EN listing page renders EUR prices on cards', async ({ page }) => {
    await page.goto('/furniture');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText(/RON/i)).toHaveCount(0);
    await expect(page.getByText(/€/).first()).toBeVisible();
  });
});
