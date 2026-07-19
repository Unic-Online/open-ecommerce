/**
 * Feature-flag gating contract.
 *
 * Each `features.*` flag, when false, must make its subsystem inert at the
 * route/layout level. These tests exercise the cheapest seam for each flag:
 *   - admin / accounts / merchantFeed / abandonedCart / analytics route trees
 *     are 404'd by the `proxy.ts` handler (one server-side gate).
 *   - The account *page* additionally self-gates via `notFoundUnless`.
 *
 * The `features` object is a const, so each test re-imports `proxy.ts` under a
 * fresh `vi.mock('@/site.config')` with the flag flipped. next-intl's
 * middleware is stubbed so the public-path branch is observable without DNS.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FeaturesConfig } from '@/site.config';

const ALL_ON: FeaturesConfig = {
  admin: true,
  abandonedCart: true,
  analytics: true,
  merchantFeed: true,
  accounts: true,
};

// next-intl middleware stub: returns a sentinel Response so we can tell the
// "handed to intl" branch apart from a 404 or a pass-through `next()`.
const INTL_SENTINEL = new Response('intl', { status: 299 });
vi.mock('next-intl/middleware', () => ({
  default: () => () => INTL_SENTINEL,
}));

async function loadProxy(features: FeaturesConfig) {
  vi.resetModules();
  vi.doMock('@/site.config', async () => {
    const actual = await vi.importActual<typeof import('@/site.config')>('@/site.config');
    return { ...actual, features };
  });
  const mod = await import('@/proxy');
  return mod.default as unknown as (req: { nextUrl: { pathname: string } }) => Response;
}

function req(pathname: string) {
  return { nextUrl: { pathname } } as { nextUrl: { pathname: string } };
}

beforeEach(() => {
  vi.resetModules();
});

describe('proxy feature-flag gating', () => {
  it('404s gated route trees when their flag is off; allows them when on', async () => {
    const cases: Array<{ flag: keyof FeaturesConfig; path: string }> = [
      { flag: 'admin', path: '/admin/orders' },
      { flag: 'admin', path: '/api/admin/orders/x/status' },
      { flag: 'accounts', path: '/api/account/request-link' },
      { flag: 'merchantFeed', path: '/google-merchant.xml' },
      { flag: 'abandonedCart', path: '/api/cron/cart-recovery' },
      { flag: 'analytics', path: '/api/meta-capi' },
    ];

    for (const { flag, path } of cases) {
      const off = await loadProxy({ ...ALL_ON, [flag]: false });
      expect(off(req(path)).status, `${flag} off → ${path}`).toBe(404);

      const on = await loadProxy(ALL_ON);
      // With the flag on, a non-intl (api/admin/asset) path passes through —
      // it must NOT be the 404 the disabled flag would have produced.
      expect(on(req(path)).status, `${flag} on → ${path}`).not.toBe(404);
    }
  });

  it('one disabled flag does not 404 another feature’s routes', async () => {
    const proxy = await loadProxy({ ...ALL_ON, admin: false });
    expect(proxy(req('/api/admin/x')).status).toBe(404);
    // accounts still on
    expect(proxy(req('/api/account/request-link')).status).not.toBe(404);
    // merchant feed still on
    expect(proxy(req('/google-merchant.xml')).status).not.toBe(404);
  });

  it('hands public storefront paths to next-intl regardless of flags', async () => {
    const proxy = await loadProxy({ ...ALL_ON, admin: false, accounts: false });
    expect(proxy(req('/furniture/oslo-nightstand')).status).toBe(299);
  });
});

describe('account page self-gate', () => {
  it('calls notFound() when accounts is disabled', async () => {
    vi.resetModules();
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    vi.doMock('next/navigation', () => ({ notFound }));
    vi.doMock('@/site.config', async () => {
      const actual = await vi.importActual<typeof import('@/site.config')>('@/site.config');
      return { ...actual, features: { ...ALL_ON, accounts: false } };
    });
    const { notFoundUnless } = await import('@/lib/feature-flags');
    expect(() => notFoundUnless(false)).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('does not call notFound() when the feature is enabled', async () => {
    vi.resetModules();
    const notFound = vi.fn();
    vi.doMock('next/navigation', () => ({ notFound }));
    const { notFoundUnless } = await import('@/lib/feature-flags');
    notFoundUnless(true);
    expect(notFound).not.toHaveBeenCalled();
  });
});
