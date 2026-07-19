import { expect, test } from '@playwright/test';

async function preAcceptCookieBanner(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
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
  });
}

async function scrollMainCtaUnderFixedHeader(page: import('@playwright/test').Page) {
  const mainCartRow = page.locator('[class*="cartRow"]').first();
  await expect(mainCartRow).toBeVisible();

  const scrollY = await mainCartRow.evaluate((element) => {
    const header = document.querySelector('header');
    const headerBottom = header?.getBoundingClientRect().bottom ?? 64;
    const rect = element.getBoundingClientRect();
    // Scroll the row decisively under the fixed header (not just grazing it)
    // so the poll below is robust against sub-pixel rounding and the layout
    // shift the floating bar itself introduces.
    return window.scrollY + rect.top - headerBottom + 120;
  });

  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await expect
    .poll(
      async () =>
        mainCartRow.evaluate((element) => {
          const header = document.querySelector('header');
          const headerBottom = header?.getBoundingClientRect().bottom ?? 64;
          return element.getBoundingClientRect().top < headerBottom;
        }),
      { message: 'main add-to-cart row should be under the fixed header' },
    )
    .toBe(true);

  return mainCartRow;
}

test.describe('Mobile product floating cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preAcceptCookieBanner(page);
  });

  test('appears when the fixed header covers the main add-to-cart row', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    await scrollMainCtaUnderFixedHeader(page);

    const floatingBar = page.locator('[class*="floatingBar"]').first();
    const floatingCta = floatingBar.getByRole('button', { name: /Adaugă în coș/i });

    // FloatingCartBar only re-checks visibility on scroll/resize events. If a
    // late layout shift on a cold server (images/fonts settling) moves the row
    // after our single programmatic scroll, the bar's state goes stale and no
    // further event ever arrives. Re-dispatch scroll until it reacts — the
    // event-stream equivalent of a real user's continued scrolling. The
    // component still has to compute visible=true itself for this to pass.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
          return floatingBar.evaluate((el) => el.className.includes('floatingBarVisible'));
        },
        { timeout: 15_000, message: 'floating bar should turn visible while the CTA row is covered' },
      )
      .toBe(true);

    await expect(floatingBar).toBeInViewport();
    await expect(floatingCta).toBeVisible();
  });

  test('closed drawer does not capture burger taps after product scroll', async ({ page }) => {
    await page.goto('/ro/mobilier/oslo-nightstand');
    await scrollMainCtaUnderFixedHeader(page);

    const burger = page.getByRole('button', { name: 'Deschide meniul' });
    const drawer = page.locator('#mobile-drawer');

    await expect
      .poll(async () =>
        burger.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const target = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return target === button || button.contains(target);
        }),
      )
      .toBe(true);

    await burger.click();
    await expect(drawer).toHaveClass(/drawerOpen/);
    await expect(page.getByRole('button', { name: 'Închide meniul' })).toBeVisible();
  });
});
