import { describe, expect, it } from 'vitest';
import { cartSyncSchema } from '@/lib/validation';
import {
  botGuard,
  extractClientIp,
  isAllowedOrigin,
  isBotUserAgent,
} from '@/plugins/abandoned-cart/server/bot-guard';

const VALID_ITEM = {
  id: 'furniture__oslo-nightstand',
  productType: 'furniture',
  productName: 'Oslo Nightstand',
  quantity: 1,
  unitPrice: 149,
  slug: 'oslo-nightstand',
  shortName: 'Oslo Nightstand',
  image: '/images/oslo-nightstand/1.jpg',
};

function makeRequest(headers: Record<string, string> = {}, body?: unknown): Request {
  const init: RequestInit = {
    method: 'POST',
    headers: new Headers(headers),
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request('https://ro.shop.example.com/api/cart/sync', init);
}

describe('cartSyncSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = cartSyncSchema.safeParse({
      items: [VALID_ITEM],
      subtotal: 149,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty items array (cart was cleared)', () => {
    const result = cartSyncSchema.safeParse({
      items: [],
      subtotal: 0,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when botCheck is missing', () => {
    const result = cartSyncSchema.safeParse({
      items: [VALID_ITEM],
      subtotal: 149,
    });
    expect(result.success).toBe(false);
  });

  it('rejects when botCheck is too short', () => {
    const result = cartSyncSchema.safeParse({
      items: [VALID_ITEM],
      subtotal: 149,
      botCheck: 'a',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed cartId (not a UUID)', () => {
    const result = cartSyncSchema.safeParse({
      cartId: 'not-a-uuid',
      items: [VALID_ITEM],
      subtotal: 149,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid UUID v4 cartId', () => {
    const result = cartSyncSchema.safeParse({
      cartId: '8a4b1c12-5e73-4f51-9b2c-1f7a6e9d2c8b',
      items: [VALID_ITEM],
      subtotal: 149,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(true);
  });

  it('rejects subtotal above the sanity ceiling', () => {
    const result = cartSyncSchema.safeParse({
      items: [VALID_ITEM],
      subtotal: 100_000_000,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 50 items', () => {
    const items = Array.from({ length: 51 }, () => VALID_ITEM);
    const result = cartSyncSchema.safeParse({
      items,
      subtotal: 0,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(false);
  });

  it('defaults marketingConsent to false when omitted', () => {
    const result = cartSyncSchema.safeParse({
      items: [VALID_ITEM],
      subtotal: 149,
      botCheck: 'abcd',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.marketingConsent).toBe(false);
    }
  });

  it('rejects an invalid email', () => {
    const result = cartSyncSchema.safeParse({
      items: [VALID_ITEM],
      subtotal: 149,
      email: 'not-an-email',
      botCheck: 'abcd',
    });
    expect(result.success).toBe(false);
  });
});

describe('isBotUserAgent', () => {
  it('flags missing user-agent as bot', () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
  });

  it('flags trivial too-short UAs as bot', () => {
    expect(isBotUserAgent('abc')).toBe(true);
  });

  it('flags known crawler signatures', () => {
    expect(isBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isBotUserAgent('curl/7.79.1')).toBe(true);
    expect(isBotUserAgent('python-requests/2.31.0')).toBe(true);
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (Linux) HeadlessChrome/123.0')).toBe(true);
  });

  it('passes a real Chrome UA', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('passes a real Safari iOS UA', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
  });
});

describe('isAllowedOrigin', () => {
  it('allows when origin header is missing (some same-origin POSTs)', () => {
    const req = new Request('https://ro.shop.example.com/api/cart/sync', { method: 'POST' });
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it('allows ro.shop.example.com', () => {
    const req = makeRequest({ origin: 'https://ro.shop.example.com' });
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it('allows localhost dev', () => {
    const req = makeRequest({ origin: 'http://localhost:3000' });
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it('allows vercel preview deployments', () => {
    const req = makeRequest({ origin: 'https://storefront-git-feat.vercel.app' });
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it('rejects an unrelated origin', () => {
    const req = makeRequest({ origin: 'https://evil.example.com' });
    expect(isAllowedOrigin(req)).toBe(false);
  });

  it('rejects a malformed origin string', () => {
    const req = makeRequest({ origin: 'not a url' });
    expect(isAllowedOrigin(req)).toBe(false);
  });
});

describe('botGuard (combined)', () => {
  const realChromeUA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  it('passes a real browser request with a botCheck token', () => {
    const req = makeRequest({
      'user-agent': realChromeUA,
      origin: 'https://ro.shop.example.com',
    });
    const result = botGuard(req, { botCheck: 'abcd' });
    expect(result.isBot).toBe(false);
  });

  it('blocks when botCheck is missing from a valid-looking request', () => {
    const req = makeRequest({
      'user-agent': realChromeUA,
      origin: 'https://ro.shop.example.com',
    });
    const result = botGuard(req, { somethingElse: true });
    expect(result.isBot).toBe(true);
    expect(result.reason).toBe('no-bot-check');
  });

  it('blocks a Googlebot UA even with a token', () => {
    const req = makeRequest({
      'user-agent': 'Googlebot/2.1',
      origin: 'https://ro.shop.example.com',
    });
    const result = botGuard(req, { botCheck: 'abcd' });
    expect(result.isBot).toBe(true);
    expect(result.reason).toBe('ua');
  });

  it('blocks a request from an unallowed origin', () => {
    const req = makeRequest({
      'user-agent': realChromeUA,
      origin: 'https://evil.example.com',
    });
    const result = botGuard(req, { botCheck: 'abcd' });
    expect(result.isBot).toBe(true);
    expect(result.reason).toBe('origin');
  });

  it('blocks when body is not an object', () => {
    const req = makeRequest({
      'user-agent': realChromeUA,
      origin: 'https://ro.shop.example.com',
    });
    expect(botGuard(req, 'not an object').isBot).toBe(true);
    expect(botGuard(req, null).isBot).toBe(true);
  });
});

describe('extractClientIp', () => {
  it('returns the first entry of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.42, 10.0.0.1' });
    expect(extractClientIp(headers)).toBe('203.0.113.42');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '203.0.113.99' });
    expect(extractClientIp(headers)).toBe('203.0.113.99');
  });

  it('returns undefined when neither header is set', () => {
    expect(extractClientIp(new Headers())).toBeUndefined();
  });
});
