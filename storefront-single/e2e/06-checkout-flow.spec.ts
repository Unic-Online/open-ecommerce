import { expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';
import { TEST_SHIPPING } from './fixtures/checkout-data';
import { mockRevolutSDK } from './fixtures/api-mocks';

// Checkout runs on the single `main` market (`/checkout`): it enables both the
// cod (pay-on-delivery) and card payment methods and prices in EUR, so the
// seeded EUR-priced item survives the CartProvider price guard.

const CHECKOUT_SHIPPING_STORAGE_KEY = 'storefront-checkout-shipping';

async function fillShipping(page: import('@playwright/test').Page) {
  await page.fill('#ship-firstName', TEST_SHIPPING.firstName);
  await page.fill('#ship-lastName', TEST_SHIPPING.lastName);
  await page.fill('#ship-phone', TEST_SHIPPING.phone);
  await page.fill('#ship-address', TEST_SHIPPING.address);
  await page.fill('#ship-city', TEST_SHIPPING.city);
  await page.fill('#ship-county', TEST_SHIPPING.county);
  await page.fill('#ship-postalCode', TEST_SHIPPING.postalCode);
}

async function waitForStoredShippingField(
  page: import('@playwright/test').Page,
  field: string,
  value: string,
) {
  await expect
    .poll(async () =>
      page.evaluate(
        ({ key, fieldName }) => {
          const stored = localStorage.getItem(key);
          if (!stored) return null;
          try {
            return (JSON.parse(stored) as Record<string, string>)[fieldName] ?? null;
          } catch {
            return null;
          }
        },
        { key: CHECKOUT_SHIPPING_STORAGE_KEY, fieldName: field },
      ),
    )
    .toBe(value);
}

// Pre-seed the captured email so the checkout page auto-skips the new
// email-only step and lands on the shipping form. The email step is
// covered by a dedicated spec (06b-checkout-email-step.spec.ts).
async function seedStoredEmail(page: import('@playwright/test').Page) {
  await page.addInitScript((email) => {
    try {
      window.localStorage.setItem('sf_user_email', email);
    } catch {
      /* storage denied */
    }
  }, TEST_SHIPPING.email);
}

test.describe('Checkout — Step 1: shipping form', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    // The e2e dev server ships a fake Revolut public key, so reaching the
    // payment step mounts the card widget's wallet effect (which loads the
    // browser SDK). Stub the SDK so it never reaches Revolut's CDN.
    await mockRevolutSDK(page);
    await seedStoredEmail(page);
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/checkout');
  });

  test('shipping step is visible by default', async ({ page }) => {
    await expect(page.getByText(/delivery address/i).first()).toBeVisible();
    await expect(page.locator('#ship-firstName')).toBeVisible();
  });

  test('order summary on the right shows the seeded item', async ({ page }) => {
    await expect(page.getByText(/order summary/i)).toBeVisible();
    await expect(page.getByText(SAMPLE_CART_ITEM.productName).first()).toBeVisible();
  });

  test('submit with empty form shows validation errors and stays on step 1', async ({
    page,
  }) => {
    await page.getByTestId('checkout-continue-payment').click();
    // Still on shipping step — payment heading should not appear.
    await expect(page.getByRole('heading', { name: /^💳 payment$/i })).toHaveCount(0);
  });

  test('valid form transitions to payment step', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    await expect(page.getByRole('heading', { name: /payment/i }).first()).toBeVisible();
    // Compact bullet-list payment UI: a radio for pay-on-delivery (cod).
    // Selecting it reveals the "Confirm order — pay on delivery" submit CTA.
    await expect(page.getByTestId('checkout-pay-method-cod')).toBeVisible();
  });

  test('Edit button on payment step returns to shipping', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
    // The shipping summary's Edit link reopens the shipping form.
    await expect(page.getByTestId('checkout-shipping-edit')).toBeVisible();
    await page.getByTestId('checkout-shipping-edit').click();
    await expect(page.locator('#ship-firstName')).toBeVisible();
  });

  test('shipping draft survives a reload', async ({ page }) => {
    await fillShipping(page);
    // Override firstName with a sentinel we'll assert against after reload.
    await page.fill('#ship-firstName', 'DraftPersist');

    await waitForStoredShippingField(page, 'firstName', 'DraftPersist');
    await page.reload();
    await expect(page.locator('#ship-firstName')).toHaveValue('DraftPersist');
  });

  test('partial shipping draft survives a reload before the form is valid', async ({ page }) => {
    await page.fill('#ship-firstName', 'PartialPersist');

    await waitForStoredShippingField(page, 'firstName', 'PartialPersist');
    await page.reload();

    await expect(page.locator('#ship-firstName')).toHaveValue('PartialPersist');
    await expect(page.locator('#ship-lastName')).toHaveValue('');
  });

});

// The Revolut wallet return route (`/revolut-pay/return/*`) redirects back to
// `/checkout`. Run this restore-draft flow there with the EUR-priced item so
// the CartProvider price guard keeps the cart on return.
test.describe('Checkout — Revolut cancel return', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    await seedStoredEmail(page);
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/checkout');
  });

  test('Revolut cancel return restores customer data and keeps the cart', async ({ page }) => {
    await fillShipping(page);
    await page.fill('#ship-firstName', 'CancelReturn');
    await waitForStoredShippingField(page, 'firstName', 'CancelReturn');

    await page.getByTestId('checkout-continue-payment').click();
    await expect(page.getByRole('heading', { name: /payment/i }).first()).toBeVisible();

    await page.goto('/revolut-pay/return/cancel');
    await page.waitForURL(/\/checkout$/);

    await expect(page.locator('#ship-firstName')).toHaveValue('CancelReturn');
    await expect(page.locator('#ship-phone')).toHaveValue(TEST_SHIPPING.phone);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = localStorage.getItem('storefront-cart');
          if (!raw) return 0;
          try {
            return (JSON.parse(raw) as unknown[]).length;
          } catch {
            return 0;
          }
        }),
      )
      .toBeGreaterThan(0);
  });
});

test.describe('Checkout — Pay on delivery (with /api/order mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
    // Stub the Revolut browser SDK: the fake e2e public key makes the card
    // widget mount its wallet effect on the payment step.
    await mockRevolutSDK(page);
    // Mock /api/order so we don't depend on Resend in the cod path. The
    // order route awaits a real merchant email send which would 500 without
    // a RESEND_API_KEY. We fulfill with a deterministic orderId instead.
    await page.route('**/api/order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 'TESTCOD1',
          success: true,
          shippingCost: 0,
          totalPrice: 149,
        }),
      });
    });

    await seedStoredEmail(page);
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/checkout');
    await fillShipping(page);
    await page.getByTestId('checkout-continue-payment').click();
  });

  test('clicking pay on delivery POSTs to /api/order with the right body', async ({ page }) => {
    const orderRequest = page.waitForRequest('**/api/order');
    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
    const req = await orderRequest;
    const body = JSON.parse(req.postData() ?? '{}');

    expect(body.paymentMethod).toBe('cod');
    expect(body.shipping.email).toBe(TEST_SHIPPING.email);
    expect(body.shipping.firstName).toBe(TEST_SHIPPING.firstName);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('successful cod order redirects to the confirmation page', async ({ page }) => {
    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
    await page.waitForURL(/\/order-confirmation\/[A-Z0-9]+/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/order-confirmation\/TESTCOD1$/);
  });

  test('cart is cleared after a successful cod order', async ({ page }) => {
    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
    await page.waitForURL(/\/order-confirmation\//, { timeout: 10_000 });
    const cartJson = await page.evaluate(() => localStorage.getItem('storefront-cart'));
    // null = cleared, '[]' = empty array — both are acceptable "empty" states.
    expect(cartJson === null || cartJson === '[]').toBeTruthy();
  });

  test('successful cod order keeps saved customer shipping data', async ({ page }) => {
    await waitForStoredShippingField(page, 'firstName', TEST_SHIPPING.firstName);

    await page.getByTestId('checkout-pay-method-cod').click();
    await page.getByTestId('checkout-confirm-cod').click();
    await page.waitForURL(/\/order-confirmation\//, { timeout: 10_000 });

    const storedShipping = await page.evaluate((key) => localStorage.getItem(key), CHECKOUT_SHIPPING_STORAGE_KEY);
    expect(storedShipping).not.toBeNull();
    expect(JSON.parse(storedShipping ?? '{}')).toMatchObject({
      firstName: TEST_SHIPPING.firstName,
      phone: TEST_SHIPPING.phone,
      address: TEST_SHIPPING.address,
    });
  });
});

test.describe('Confirmation page', () => {
  test('renders order id and shipping copy for unknown order', async ({ page }) => {
    // Confirmation page is server-rendered with fallback copy when the order
    // doc doesn't exist. A made-up orderId still returns 200.
    const response = await page.goto('/order-confirmation/MADEUPID');
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/#MADEUPID/i)).toBeVisible();
    await expect(page.getByText(/your order/i).first()).toBeVisible();
  });

  test('unknown or unresolved confirmation page does not clear saved customer data', async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      {
        key: CHECKOUT_SHIPPING_STORAGE_KEY,
        value: {
          firstName: 'ConfirmPersist',
          email: 'confirm@test.example',
          phone: '+44 7700 900000',
        },
      },
    );

    await page.goto('/order-confirmation/MADEUPID');

    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          return (JSON.parse(raw) as { firstName?: string }).firstName ?? null;
        }, CHECKOUT_SHIPPING_STORAGE_KEY),
      )
      .toBe('ConfirmPersist');
  });
});
