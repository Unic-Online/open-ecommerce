import { devices, expect, test } from '@playwright/test';
import { clearCartStorage, seedCart, SAMPLE_CART_ITEM } from './fixtures/cart';

// Exit-intent specs run on the RO storefront (`/ro`). Storefront pages derive
// their market from the URL locale (getMarketForLocale), so `/ro` → the `ro`
// market and the seeded RON-priced item survives the CartProvider price guard.

test.describe('Phase 1 — exit-intent popup', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  // The detector listens on document for `mouseout` with relatedTarget=null
  // and clientY <= 0. We dispatch that synthetically via page.evaluate
  // because `page.mouse.move(x, -1)` doesn't fire a mouseout that satisfies
  // the relatedTarget=null check on every browser.
  async function fireExitIntent(page: import('@playwright/test').Page) {
    await page.evaluate(() => {
      const evt = new MouseEvent('mouseout', {
        bubbles: true,
        cancelable: true,
        clientY: -1,
        relatedTarget: null,
      });
      document.dispatchEvent(evt);
    });
  }

  async function moveMouseThroughTopEdge(page: import('@playwright/test').Page) {
    await page.mouse.move(400, 300);
    await page.mouse.move(400, -10);
  }

  // Negative assertion without a magic sleep. The detector decides
  // synchronously on the event, but the popup mounts on the next React
  // commit, so a bare toHaveCount(0) could pass before that commit lands.
  // Re-fire the trigger across a bounded window: if the popup ever mounts,
  // toHaveCount(0) throws and toPass keeps retrying until it times out and
  // the test fails; if it never mounts, toPass passes on the first round.
  async function expectPopupNeverShows(
    page: import('@playwright/test').Page,
    fire: () => Promise<void>,
  ) {
    const dialog = page.getByRole('dialog', {
      name: /nu plecai fără coșul tău/i,
    });
    await expect(async () => {
      await fire();
      await expect(dialog).toHaveCount(0);
    }).toPass({ timeout: 1500 });
  }

  test('fires when cart has items and mouse leaves through the top', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro');
    // Wait for cart-context to hydrate (its useEffect populates items).
    await page.waitForResponse('/api/cart/sync');

    await fireExitIntent(page);

    const dialog = page.getByRole('dialog', {
      name: /nu plecai fără coșul tău/i,
    });
    await expect(dialog).toBeVisible({ timeout: 4000 });
  });

  test('fires from a real desktop top-edge mouse leave', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro');
    await page.waitForResponse('/api/cart/sync');

    await moveMouseThroughTopEdge(page);

    await expect(
      page.getByRole('dialog', { name: /nu plecai fără coșul tău/i }),
    ).toBeVisible({ timeout: 4000 });
  });

  test('does not fire when the cart is empty', async ({ page }) => {
    await page.goto('/ro');
    await expectPopupNeverShows(page, () => fireExitIntent(page));
  });

  test('does not fire on /checkout', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro/checkout');
    await expectPopupNeverShows(page, () => fireExitIntent(page));
  });

  test('does not fire when an email is already stored', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.addInitScript(() => {
      localStorage.setItem('sf_user_email', 'already@known.test');
    });
    await page.goto('/ro');
    await page.waitForResponse('/api/cart/sync');
    await expectPopupNeverShows(page, () => fireExitIntent(page));
  });

  test('submitting the form persists the email and shows success state', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro');
    await page.waitForResponse('/api/cart/sync');
    await fireExitIntent(page);

    const dialog = page.getByRole('dialog', {
      name: /nu plecai fără coșul tău/i,
    });
    await expect(dialog).toBeVisible();

    const captureRequest = page.waitForRequest('/api/capture-email');
    const input = dialog.getByPlaceholder(/introdu aici adresa ta de email/i);
    await input.fill('happy@buyer.test');
    await dialog.getByRole('button', { name: /salvează/i }).click();

    const req = await captureRequest;
    const body = JSON.parse(req.postData() ?? '{}');
    expect(body.email).toBe('happy@buyer.test');
    expect(body.source).toBe('exit_intent_popup');

    // After submit, the dialog's labelledby h2 changes ("Mulțumim! 🎉"), so
    // the original accessible-name selector no longer matches. Target the
    // success text directly — it's unique on the page.
    await expect(page.getByText(/mulțumim/i).first()).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('sf_user_email')))
      .toBe('happy@buyer.test');
  });
});

// ---------------------------------------------------------------------------
// Mobile triggers — real phone-shaped journeys under device emulation.
// Trigger 2 (fast upward flick) and Trigger 3 (back-intercept; the Playwright
// webServer env enables NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT suite-wide —
// arming is touch-only, so desktop specs above are unaffected).
// ---------------------------------------------------------------------------
test.describe('Mobile — exit-intent triggers', () => {
  // devices['Pixel 5'] includes defaultBrowserType, which Playwright forbids
  // in a describe-level use() — strip it and keep the emulation fields.
  const { defaultBrowserType: _browserType, ...pixel5 } = devices['Pixel 5'];
  test.use(pixel5);

  const dialogName = /nu plecai fără coșul tău/i;

  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  /**
   * Real flicks arrive as a stream of per-frame scroll deltas, never one
   * jump — pace the synthetic gesture with rAF so genuine scroll events fire
   * each frame. touchstart first: only finger-driven scrolls may trigger.
   */
  async function flickUp(
    page: import('@playwright/test').Page,
    stepPx: number,
    frameDelayMs = 0,
    startYPx = 1200,
  ) {
    await page.evaluate(
      async ({ step, delay, startY }) => {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        let y = Math.min(startY, maxScroll);
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));

        document.body.dispatchEvent(
          new Event('touchstart', { bubbles: true }),
        );
        while (y > 0) {
          y = Math.max(0, y - step);
          window.scrollTo(0, y);
          await new Promise((r) => requestAnimationFrame(r));
          if (delay) await new Promise((r) => setTimeout(r, delay));
        }
        document.body.dispatchEvent(new Event('touchend', { bubbles: true }));
      },
      { step: stepPx, delay: frameDelayMs, startY: startYPx },
    );
  }

  // Negative assertion without a magic sleep. A slow scroll never reaches the
  // flick velocity threshold at any point in its gesture (or its momentum
  // tail), so re-firing it across a bounded window and asserting the popup
  // never mounts is robust: if a regression made it trigger, the gesture
  // would fire the popup during one of these rounds, toHaveCount(0) would
  // throw, and toPass would keep retrying until it times out → test fails.
  async function expectFlickNeverShows(
    page: import('@playwright/test').Page,
    fire: () => Promise<void>,
  ) {
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(async () => {
      await fire();
      await expect(dialog).toHaveCount(0);
    }).toPass({ timeout: 4000 });
  }

  test('fast upward flick on a product page fires the popup', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro/mobilier/oslo-nightstand');
    await page.waitForResponse('/api/cart/sync');

    await flickUp(page, 150); // ~9000px/s — a hard flick toward the address bar

    await expect(page.getByRole('dialog', { name: dialogName })).toBeVisible({
      timeout: 4000,
    });
  });

  test('slow reading scroll upward does not fire the popup', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro/mobilier/oslo-nightstand');
    await page.waitForResponse('/api/cart/sync');

    // ~300px/s — leisurely re-reading scroll. Short start offset keeps each
    // re-fired round cheap; the velocity (the only thing that gates the
    // detector) is unchanged.
    await expectFlickNeverShows(page, () => flickUp(page, 30, 100, 200));
  });

  test('back press from a product page is intercepted once', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    await page.goto('/ro/mobilier/oslo-nightstand');
    await page.waitForResponse('/api/cart/sync');

    // First touch arms the same-URL history sentinel (cart non-empty, no
    // stored email → the popup is allowed to show, so arming proceeds).
    await page.evaluate(() => {
      document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.history.state as Record<string, unknown> | null)
              ?.storeExitIntentSentinel === true,
        ),
      )
      .toBe(true);

    await page.goBack();

    // The sentinel clones the product URL: the popup shows and the user is
    // still on the page they tried to leave.
    await expect(page.getByRole('dialog', { name: dialogName })).toBeVisible({
      timeout: 4000,
    });
    await expect(page).toHaveURL(/\/ro\/mobilier\/oslo-nightstand/);
  });

  test('back from /checkout re-arms; the following back press intercepts', async ({ page }) => {
    await seedCart(page, [SAMPLE_CART_ITEM]);
    // Navigate via /ro first so Back #2 lands on /ro rather than about:blank.
    await page.goto('/ro');
    await page.goto('/ro/mobilier/oslo-nightstand');
    await page.waitForResponse('/api/cart/sync');

    // Arm the sentinel on the product page.
    await page.evaluate(() => {
      document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.history.state as Record<string, unknown> | null)
              ?.storeExitIntentSentinel === true,
        ),
      )
      .toBe(true);

    // Simulate leaving to /checkout via an SPA pushState — this keeps the
    // product page's React tree alive so the detector's popstate listener
    // stays registered. Using page.goto('/checkout') would trigger a full
    // hard navigation, making page.goBack() a full reload rather than an
    // SPA popstate, so onPopState would never fire and the re-arm logic
    // would be bypassed.
    await page.evaluate(() =>
      window.history.pushState({}, '', '/checkout'),
    );
    await expect(page).toHaveURL(/\/checkout/);

    // Back #1: SPA popstate fires, e.state has the sentinel →
    // onPopState sets backSentinelArmed = true. No popup (we're staying
    // on-site; /checkout is a skip path and this hop is the return trip).
    await page.goBack();
    await page.waitForURL(/\/ro\/mobilier\/oslo-nightstand/);
    await expect(page.getByRole('dialog', { name: dialogName })).toHaveCount(0);
    // Back #1 re-armed the sentinel (onPopState set backSentinelArmed). Poll
    // the history-state sentinel so Back #2 only fires once it's deterministically
    // re-armed — replaces a flaky fixed wait.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window.history.state as Record<string, unknown> | null)
              ?.storeExitIntentSentinel === true,
        ),
      )
      .toBe(true);

    // Back #2: the actual exit attempt — intercepted with the popup, still on
    // the product page.
    await page.goBack();
    await expect(page.getByRole('dialog', { name: dialogName })).toBeVisible({
      timeout: 4000,
    });
    await expect(page).toHaveURL(/\/ro\/mobilier\/oslo-nightstand/);
  });

  test('back press with an empty cart is NOT intercepted (no sentinel armed)', async ({ page }) => {
    await page.goto('/ro');
    await page.goto('/ro/mobilier/oslo-nightstand');

    await page.evaluate(() => {
      document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    // Arming is gated on the popup being able to show — empty cart blocks it.
    expect(
      await page.evaluate(
        () =>
          (window.history.state as Record<string, unknown> | null)
            ?.storeExitIntentSentinel === true,
      ),
    ).toBe(false);

    await page.goBack();
    await expect(page).toHaveURL(/\/ro$|\/ro\/$/);
    await expect(page.getByRole('dialog', { name: dialogName })).toHaveCount(0);
  });
});
