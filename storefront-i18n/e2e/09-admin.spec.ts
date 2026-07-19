import { expect, test } from '@playwright/test';
import { e2eSecrets } from '../playwright.config';
import { clearCartStorage } from './fixtures/cart';

const TEST_ADMIN_PASSWORD = e2eSecrets.adminPassword;

test.describe('Admin auth', () => {
  test.beforeEach(async ({ page }) => {
    await clearCartStorage(page);
  });

  test('GET /admin without a session redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/admin/login', { timeout: 5000 });
    expect(page.url()).toMatch(/\/admin\/login$/);
  });

  test('login form renders', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: /admin sign-in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('rejects an obviously wrong password', async ({ request }) => {
    const res = await request.post('/api/admin/login', {
      data: { password: 'definitely-not-the-real-password' },
    });
    expect(res.status()).toBe(401);
  });

  test('correct password authenticates and unlocks /admin', async ({ request }) => {
    const login = await request.post('/api/admin/login', {
      data: { password: TEST_ADMIN_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const json = await login.json();
    expect(json.ok).toBe(true);

    // The session cookie should now let us through the layout's auth gate.
    const dash = await request.get('/admin');
    expect(dash.status()).toBe(200);
  });

  test('logout route always returns ok', async ({ request }) => {
    const res = await request.post('/api/admin/logout');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});

test.describe('Admin force-advance route', () => {
  test('rejects unauthenticated callers with 401', async ({ request }) => {
    const res = await request.post('/api/admin/cart/00000000-0000-0000-0000-000000000000/advance');
    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toBe('unauthenticated');
  });
});
