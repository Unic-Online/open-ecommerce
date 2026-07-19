import { expect, test } from '@playwright/test';
import { clearCartStorage } from './fixtures/cart';

// Verifies the three recommendation surfaces on the product page:
// upsell card, cross-sell grid, and popular-products grid. Runs on the RO
// storefront so the region/labels are in Romanian.

test.describe('Product recommendations', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  // oslo-nightstand declares `upsellSlug: 'aria-console'`, so its page shows an
  // upsell card pointing at the Aria Console.
  test('oslo-nightstand page shows the upsell card pointing to aria-console', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    const upsellCard = page.getByRole('link', { name: /vezi modelul premium/i });
    await expect(upsellCard).toBeVisible();
    await expect(upsellCard).toHaveAttribute('href', /\/mobilier\/aria-console$/);
  });

  // aria-console has no `upsellSlug`, so no upsell card renders.
  test('aria-console page does not show an upsell card', async ({ page }) => {
    await page.goto('/ro/mobilier/aria-console');
    await expect(
      page.getByRole('link', { name: /vezi modelul premium/i }),
    ).toHaveCount(0);
  });

  test('oslo-nightstand cross-sell grid lists its sibling product', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    const crossSell = page.getByRole('region', { name: /alți clienți au cumpărat/i });
    await expect(crossSell).toBeVisible();
    // oslo-nightstand declares one crossSellSlug (aria-console).
    await expect(crossSell.getByRole('link')).toHaveCount(1);
  });

  test('Popular grid on a product page shows products from other categories', async ({
    page,
  }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    const popular = page.getByRole('region', { name: /produse populare/i });
    await expect(popular).toBeVisible();
    // At least one card present (popularSlugs point at lighting + outdoor).
    await expect(popular.getByRole('link').first()).toBeVisible();
    // Category labels use uppercase tracking — confirm at least one.
    await expect(popular.getByText(/^iluminat$|^exterior$/i).first()).toBeVisible();
  });

  test('clicking a cross-sell card navigates to that product', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    const crossSell = page.getByRole('region', { name: /alți clienți au cumpărat/i });
    const firstCard = crossSell.getByRole('link').first();
    const href = await firstCard.getAttribute('href');
    // The card links to the aria-console product. next-intl may render the RO
    // pathname on the href but navigate client-side to the canonical EN
    // pathname, so assert on the slug rather than the exact localized path.
    const slug = href!.split('/').pop()!;
    await firstCard.click();
    await page.waitForURL(new RegExp(`/${slug}$`));
    expect(page.url()).toContain(slug);
  });

  test('terra-path-light has no cross-sell (no crossSellSlugs declared)', async ({
    page,
  }) => {
    // terra-path-light declares no `crossSellSlugs`, so the cross-sell region
    // must be absent while the popular grid still points at other categories.
    await page.goto('/ro/exterior/terra-path-light');
    await expect(
      page.getByRole('region', { name: /alți clienți au cumpărat/i }),
    ).toHaveCount(0);
    // But still has a popular grid pointing at the other categories.
    await expect(
      page.getByRole('region', { name: /produse populare/i }),
    ).toBeVisible();
  });
});
