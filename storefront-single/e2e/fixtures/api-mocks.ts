import type { Page } from '@playwright/test';

// API mocks for routes the e2e suite cannot exercise directly:
//
//   - Revolut Merchant API (no sandbox keys in CI)
//   - The browser-side Revolut SDK that pulls in cross-origin scripts
//     (its iframe is essentially un-driveable from Playwright).
//
// Apply these BEFORE page.goto() so the routes are already trapped when the
// page loads.

const FAKE_REVOLUT = {
  orderId: 'E2EORDER',
  publicId: 'fake-revolut-public-id',
  checkoutUrl: 'https://sandbox-merchant.revolut.com/cko/index.html?token=fake',
  providerOrderId: 'fake-revolut-uuid-for-tests',
};

/**
 * Intercept /api/payments/revolut/create-order so we don't actually hit
 * Revolut's API in tests. Returns deterministic fake order data.
 */
export async function mockRevolutCreateOrder(page: Page): Promise<void> {
  await page.route('**/api/payments/revolut/create-order', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_REVOLUT),
    });
  });
}

// A faithful stand-in for the real `merchant.revolut.com/embed.js` global.
// Mirrors the actual API surface the npm wrapper (@revolut/checkout,
// esm/loader.js + esm/paymentsLoader.js) expects from `window.RevolutCheckout`:
//   - callable directly: `RevolutCheckout(token, mode) => Promise<Instance>`
//     with `createCardField` / `setDefaultLocale` / `destroy` / etc.
//   - a static `.payments({ publicToken, locale, mode })` loader method
//     returning `Promise<PaymentsModuleInstance>` with `revolutPay` /
//     `paymentRequest` / `destroy` / `setDefaultLocale`.
// Widget `mount`/`render` calls append a real, visible DOM node (tagged with
// a `data-fake-*` attribute) so e2e specs can assert the widget actually
// mounted, not just that the container div exists.
const FAKE_REVOLUT_SDK_SCRIPT = `
(function () {
  function makeRevolutPayInstance() {
    return {
      mount: function (target, options) {
        var el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-fake-revolut-pay', 'true');
        btn.textContent = 'Revolut Pay (fake)';
        btn.addEventListener('click', function () {
          if (options && typeof options.createOrder === 'function') options.createOrder();
        });
        el.appendChild(btn);
      },
      on: function () {},
      destroy: function () {},
    };
  }

  function makePaymentRequestInstance(target) {
    var mounted = false;
    return {
      canMakePayment: function () {
        return Promise.resolve('applePay');
      },
      render: function () {
        if (!mounted && target) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('data-fake-payment-request', 'true');
          btn.textContent = 'Apple Pay (fake)';
          target.appendChild(btn);
          mounted = true;
        }
        return Promise.resolve();
      },
      destroy: function () {},
    };
  }

  function makePaymentsModule() {
    return {
      revolutPay: makeRevolutPayInstance(),
      paymentRequest: function (target) {
        return makePaymentRequestInstance(target);
      },
      payByBank: function () {
        return { show: function () {}, destroy: function () {} };
      },
      destroy: function () {},
      setDefaultLocale: function () {},
    };
  }

  function makeCheckoutInstance() {
    return {
      payWithPopup: function () { return makeCheckoutInstance(); },
      createCardField: function (options) {
        if (options && options.target) {
          var field = document.createElement('div');
          field.setAttribute('data-fake-card-field', 'true');
          // Real iframe fields render with visible height; give this one a
          // non-zero box too, otherwise Playwright's toBeVisible() correctly
          // reports an empty 0x0 div as hidden even though display:block.
          field.style.minHeight = '24px';
          field.textContent = 'Card field (fake)';
          options.target.appendChild(field);
        }
        return {
          submit: function () {
            if (options && typeof options.onSuccess === 'function') options.onSuccess();
          },
          validate: function () {},
          destroy: function () {},
        };
      },
      revolutPay: function () { return makeCheckoutInstance(); },
      paymentRequest: function (options) {
        return makePaymentRequestInstance(options && options.target);
      },
      destroy: function () {},
      setDefaultLocale: function () {},
      payments: function () { return Promise.resolve(makePaymentsModule()); },
      embeddedCheckout: function () { return { destroy: function () {} }; },
    };
  }

  function RevolutCheckout() {
    return Promise.resolve(makeCheckoutInstance());
  }
  RevolutCheckout.payments = function () {
    return Promise.resolve(makePaymentsModule());
  };
  RevolutCheckout.upsell = function () {
    return Promise.resolve({ destroy: function () {}, setDefaultLocale: function () {} });
  };
  RevolutCheckout.embeddedCheckout = function () { return { destroy: function () {} }; };

  window.RevolutCheckout = RevolutCheckout;
})();
`;

/**
 * Intercept the Revolut SDK script load so the page's React tree doesn't
 * stall waiting on a CDN that's blocked in CI. Serves a fake `embed.js` that
 * mirrors the real SDK's API surface (see FAKE_REVOLUT_SDK_SCRIPT) so the
 * wallet/card-field init code path actually succeeds instead of silently
 * throwing `TypeError`s that no test used to catch.
 */
export async function mockRevolutSDK(page: Page): Promise<void> {
  await page.route(/merchant\.revolut\.com.*\.js/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: FAKE_REVOLUT_SDK_SCRIPT,
    });
  });
  await page.route(/api\/.*revolut.*sdk/i, async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });
}

/**
 * Apply all mock routes that an end-to-end checkout test needs. Call from
 * test.beforeEach BEFORE the first page.goto().
 */
export async function mockExternalApis(page: Page): Promise<void> {
  await mockRevolutCreateOrder(page);
  await mockRevolutSDK(page);
}
