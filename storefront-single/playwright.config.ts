import { defineConfig, devices } from '@playwright/test';

// Notes on the divergence from the original PlaywrightTesting.md plan:
//   - workers: 4 (was 1). Each Playwright test gets a fresh browser context
//     by default. Cart isolation is handled by the cookie scope of that
//     context, so parallelism is safe.
//   - webServer.env injects test-only flags (dry-run emails, plugin enabled)
//     so the dev server boots in a deterministic configuration.
//   - reuseExistingServer: true lets you `pnpm dev` once and re-run the
//     suite repeatedly without restart overhead.
//   - Hard-coded TEST_HMAC and TEST_CRON_SECRET so route signatures and
//     bearer auth work without depending on a populated .env.local.

const TEST_HMAC = 'e2e-only-not-a-real-secret-pad-pad-pad-pad-pad-pad-pad';
const TEST_CRON_SECRET = 'e2e-cron-secret';
const TEST_ADMIN_PASSWORD = 'e2e-admin-pw';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI runners have 2 cores and compile routes on demand (dev server) — more
  // workers just thrash and push soft navigations past assertion timeouts.
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'html',
  outputDir: './e2e-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile project is opt-in via PW_MOBILE=1 — the abandoned-cart back-button
    // hijack needs real iOS/Android to verify, the emulator only proves the
    // listener is wired.
    ...(process.env.PW_MOBILE === '1'
      ? [
          {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
          },
        ]
      : []),
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // Plugin features under test
      NEXT_PUBLIC_ABANDONED_CART_ENABLED: '1',
      NEXT_PUBLIC_ABANDONED_CART_EXIT_INTENT: '1',
      NEXT_PUBLIC_ABANDONED_CART_CART_SYNC: '1',
      NEXT_PUBLIC_ABANDONED_CART_TEST_MODE: '1',
      // Back-intercept experiment: arming is touch-only so desktop specs above
      // are unaffected; enables Trigger 3 for the mobile e2e describe block.
      NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT: '1',

      // Server-side flags
      CART_RECOVERY_HMAC_SECRET: TEST_HMAC,
      CART_RECOVERY_CRON_SECRET: TEST_CRON_SECRET,
      // Admin password for the orders dashboard E2E. Same HMAC secret is
      // reused by admin-auth.ts to sign the session cookie.
      ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      // Isolate writes to a dedicated test DB so we don't pollute the real
      // dev/prod 'storefront' database. Same cluster, different DB name.
      MONGODB_DB_NAME: 'storefront-e2e',
      // Recovery emails are mocked at the boundary — Resend is never called.
      RECOVERY_EMAIL_DRY_RUN: '1',
      ABANDONED_CART_RECOVERY_EMAIL_ENABLED: '0',
      // Catch-all: short-circuits every sendEmail() call (order, webhook,
      // contact, shipment, recovery). Tests can still assert sendEmail was
      // invoked because the wrapper still returns a deterministic id.
      EMAIL_DRY_RUN: '1',
      // Enables `/api/test-only/...` debug endpoints (e.g. force-email-fail-next).
      // The gate (`src/lib/test-endpoint-gate.ts`) requires this OR
      // NODE_ENV=development. Production envs never have it set.
      E2E_DEBUG_ENDPOINTS: '1',
      // Revolut sandbox passthrough: tests in 20-revolut-sandbox.spec.ts
      // require these to be set in the parent shell (run via
      // `dotenv -e .env.staging -- pnpm test:e2e ...`). Absent → tests skip.
      ...(process.env.REVOLUT_API_MODE
        ? { REVOLUT_API_MODE: process.env.REVOLUT_API_MODE }
        : {}),
      ...(process.env.REVOLUT_SECRET_KEY
        ? { REVOLUT_SECRET_KEY: process.env.REVOLUT_SECRET_KEY }
        : {}),
      ...(process.env.REVOLUT_WEBHOOK_SIGNING_SECRET
        ? { REVOLUT_WEBHOOK_SIGNING_SECRET: process.env.REVOLUT_WEBHOOK_SIGNING_SECRET }
        : {}),
      ...(process.env.NEXT_PUBLIC_REVOLUT_API_MODE
        ? { NEXT_PUBLIC_REVOLUT_API_MODE: process.env.NEXT_PUBLIC_REVOLUT_API_MODE }
        : {}),
      // Always expose a public key so the card section of the Revolut widget
      // renders (otherwise it shows a "not configured" notice and the
      // phantom-orders spec's explicit-prepare CTA never appears → the test
      // can't run in CI). The browser-side SDK is stubbed by mockRevolutSDK
      // and create-order is mocked, so this fake key never reaches Revolut.
      // A real key from the parent shell (20-revolut-sandbox) takes priority.
      NEXT_PUBLIC_REVOLUT_PUBLIC_KEY:
        process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY ?? 'pk_e2e_fake_public_key',
    },
  },
});

export const e2eSecrets = {
  cronSecret: TEST_CRON_SECRET,
  hmacSecret: TEST_HMAC,
  adminPassword: TEST_ADMIN_PASSWORD,
};
