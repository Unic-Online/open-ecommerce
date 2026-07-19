import { expect, test } from '@playwright/test';
import { e2eSecrets } from '../playwright.config';

test.describe('Phase 3 — recovery cron endpoint', () => {
  test('rejects with 403 when the bearer token is missing', async ({ request }) => {
    const res = await request.post('/api/cron/cart-recovery');
    expect(res.status()).toBe(403);
  });

  test('rejects with 403 when the bearer token is wrong', async ({ request }) => {
    const res = await request.post('/api/cron/cart-recovery', {
      headers: { Authorization: 'Bearer obviously-wrong' },
    });
    expect(res.status()).toBe(403);
  });

  test('returns a well-formed JSON summary in test mode', async ({ request }) => {
    const res = await request.post('/api/cron/cart-recovery', {
      headers: { Authorization: `Bearer ${e2eSecrets.cronSecret}` },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty('abandoned');
    expect(json).toHaveProperty('step1Sent');
    expect(json).toHaveProperty('step2Sent');
    expect(json).toHaveProperty('step3Sent');
    expect(json).toHaveProperty('errors');
    expect(json).toHaveProperty('dryRun');
    // Test config sets RECOVERY_EMAIL_DRY_RUN=1, so this run never calls Resend.
    expect(json.dryRun).toBe(true);
    expect(Array.isArray(json.errors)).toBe(true);
    expect(typeof json.abandoned).toBe('number');
  });

  test('GET also works (Vercel Cron uses GET)', async ({ request }) => {
    const res = await request.get('/api/cron/cart-recovery', {
      headers: { Authorization: `Bearer ${e2eSecrets.cronSecret}` },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('Phase 3 — apply-coupon route', () => {
  test('rejects unknown code', async ({ request }) => {
    const res = await request.post('/api/cart/apply-coupon', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
        Origin: 'http://localhost:3000',
      },
      data: {
        code: 'SHOP-NOPE-NOPE',
        email: 'nobody@nowhere.test',
        botCheck: 'abcd',
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.reason).toBe('unknown-code');
  });

  test('rejects malformed payload', async ({ request }) => {
    const res = await request.post('/api/cart/apply-coupon', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
        Origin: 'http://localhost:3000',
      },
      data: { code: 'X', botCheck: 'abcd' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects bot UA silently with unknown-code', async ({ request }) => {
    const res = await request.post('/api/cart/apply-coupon', {
      headers: {
        'User-Agent': 'Googlebot/2.1',
        Origin: 'http://localhost:3000',
      },
      data: {
        code: 'SHOP-AAAA-BBBB',
        email: 'whatever@x.test',
        botCheck: 'abcd',
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.reason).toBe('unknown-code');
  });
});
