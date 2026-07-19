import { expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';

// The header cart button is identified by a stable test id. Locator-by-role
// + aria-label regex is brittle under English pluralization ("item"/"items")
// and copy edits. The id is part of the component contract.
const cartButton = (page: import('@playwright/test').Page) =>
  page.getByTestId('cart-toggle');

test.describe('Cart sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  test('header cart icon reflects total items count', async ({ page }) => {
    await seedCart(page, [{ ...SAMPLE_CART_ITEM, quantity: 3 }]);
    await page.goto('/');
    // Both the visible badge ("3") and the aria-label encode the count.
    // The aria-label uses English plural rules ("item"/"items") so we accept
    // either form.
    await expect(cartButton(page)).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/basket \(3 items?\)/i),
    );
  });

  test('clicking the cart icon opens the sidebar with the seeded item', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await cartButton(page).click();

    const sidebar = page.locator('aside').filter({ hasText: /your basket/i });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText(SAMPLE_CART_ITEM.productName);
  });

  test('Increase (+) button increments quantity', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await cartButton(page).click();

    const increment = page.getByTestId('cart-item-increase').first();
    await increment.click();

    // Quantity badge should now read 2.
    const sidebar = page.locator('aside').filter({ hasText: /your basket/i });
    await expect(sidebar.getByText(/^2$/).first()).toBeVisible();
  });

  test('Decrease (-) on quantity 1 removes the item', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await cartButton(page).click();

    const decrement = page.getByTestId('cart-item-decrease').first();
    await decrement.click();

    const sidebar = page.locator('aside').filter({ hasText: /your basket/i });
    await expect(sidebar.getByText(/your basket is empty/i)).toBeVisible();
  });

  test('Remove button deletes the item', async ({ page }) => {
    await seedCart(page, [{ ...SAMPLE_CART_ITEM, quantity: 2 }]);
    await page.goto('/');
    await cartButton(page).click();

    await page.getByTestId('cart-item-remove').first().click();

    const sidebar = page.locator('aside').filter({ hasText: /your basket/i });
    await expect(sidebar.getByText(/your basket is empty/i)).toBeVisible();
  });

  test('empty cart shows the empty-state copy', async ({ page }) => {
    await page.goto('/');
    await cartButton(page).click();

    const sidebar = page.locator('aside').filter({ hasText: /your basket/i });
    await expect(sidebar.getByText(/your basket is empty/i)).toBeVisible();
  });

  test('browser back closes the open sidebar without leaving the page', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await cartButton(page).click();

    const sidebar = page.getByTestId('cart-sidebar');
    await expect(sidebar).toHaveAttribute('data-open', 'true');

    await page.goBack();

    await expect(sidebar).toHaveAttribute('data-open', 'false');
    await expect(page).toHaveURL('/');
  });

  test('closing via the X consumes the history entry so back still navigates', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await page.goto('/contact');
    await cartButton(page).click();

    const sidebar = page.getByTestId('cart-sidebar');
    await expect(sidebar).toHaveAttribute('data-open', 'true');

    await page.getByTestId('cart-close').click();
    await expect(sidebar).toHaveAttribute('data-open', 'false');
    // The sentinel entry is consumed asynchronously by history.back().
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Boolean(
              (window.history.state as Record<string, unknown> | null)
                ?.storeCartSentinel,
            ),
        ),
      )
      .toBe(false);

    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('back after checkout returns to the pre-cart page in one press', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/contact');
    await cartButton(page).click();
    await page.getByTestId('cart-checkout').click();
    await expect(page).toHaveURL(/\/checkout$/);

    await page.goBack();

    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByTestId('cart-sidebar')).toHaveAttribute('data-open', 'false');
  });

  test('cart sync POST runs whenever items change', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/');
    await page.waitForResponse('/api/cart/sync');

    await cartButton(page).click();
    const incrementResponse = page.waitForResponse(
      (res) => res.url().endsWith('/api/cart/sync') && res.status() === 200,
    );
    await page.getByTestId('cart-item-increase').first().click();
    const res = await incrementResponse;
    const body = JSON.parse(res.request().postData() ?? '{}');
    expect(body.items[0].quantity).toBe(2);
  });
});
