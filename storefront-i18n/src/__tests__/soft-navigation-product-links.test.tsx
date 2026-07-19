/**
 * Issue #2 — internal navigation must use next/link Link, not raw <a href>.
 *
 * Raw anchors trigger a full page reload (visible loading bar in the browser).
 * The Link component does client-side soft navigation. Both the breadcrumb
 * (ProductPage) and the category link (ProductBuyBox) point at internal
 * routes (/, /furniture, /lighting, etc.) so they must be Link.
 *
 * Strategy: override the @/i18n/navigation Link mock from setup.ts so that
 * its rendered <a> carries data-next-link="true". Any anchor in the rendered
 * tree that targets an internal route (href starting with "/") MUST carry
 * that attribute.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders } from './test-utils';
import { CartProvider } from '@/lib/cart-context';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement(
      'a',
      { href, 'data-next-link': 'true', ...props },
      children,
    ),
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  redirect: vi.fn(),
  getPathname: vi.fn(
    (opts: { href: string | { pathname: string; params?: Record<string, string | number> } }) =>
      typeof opts.href === 'string' ? opts.href : opts.href.pathname,
  ),
}));

vi.mock('@/components/product-template/ProductGallery', () => ({ default: () => null }));
vi.mock('@/components/TikTokEmbed', () => ({ default: () => null }));
vi.mock('@/components/reviews/ReviewSection', () => ({ default: () => null }));

vi.mock('@/i18n/market-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/market-resolver')>();
  return {
    ...actual,
    getCurrentMarket: vi.fn(async () => 'ro'),
  };
});

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const roProduct = (await import('../../messages/ro/product.json')).default;
  const roCommon = (await import('../../messages/ro/common.json')).default;
  const roReviews = (await import('../../messages/ro/reviews.json')).default;
  const messages: Record<string, unknown> = {
    product: roProduct,
    common: roCommon,
    reviews: roReviews,
  };
  return {
    getLocale: vi.fn(async () => 'ro'),
    getTranslations: vi.fn(async ({ namespace }: { namespace: string }) =>
      createTranslator({ locale: 'ro', namespace, messages }),
    ),
  };
});

import ProductPage from '@/components/product-template/ProductPage';
import ProductBuyBox from '@/components/product-template/ProductBuyBox';
import { getProduct } from '@/i18n/product';

function isInternalAnchor(el: HTMLElement): boolean {
  const href = el.getAttribute('href') ?? '';
  return href.startsWith('/') && !href.startsWith('//');
}

describe('Issue #2 — internal anchors use next/link Link', () => {
  it('ProductPage breadcrumb items are Next Link (no full reload)', async () => {
    const product = getProduct({ locale: 'ro', market: 'ro', category: 'furniture', slug: 'oslo-nightstand' });
    expect(product).not.toBeNull();
    const ui = await ProductPage({ product: product! });
    renderWithProviders(
      <CartProvider>{ui}</CartProvider>,
    );

    const allLinks = screen.getAllByRole('link');
    const internal = allLinks.filter(isInternalAnchor);
    expect(internal.length).toBeGreaterThan(0);
    const offenders = internal.filter((a) => a.getAttribute('data-next-link') !== 'true');
    expect(
      offenders,
      `Internal anchors that bypass next/link Link (cause full page reload):\n` +
        offenders
          .map((a) => `  href=${a.getAttribute('href')} text="${a.textContent?.trim()}"`)
          .join('\n'),
    ).toEqual([]);
  });

  it('ProductBuyBox category link is a Next Link', () => {
    const product = getProduct({ locale: 'ro', market: 'ro', category: 'furniture', slug: 'oslo-nightstand' });
    expect(product).not.toBeNull();
    expect(product!.categoryLink).toBeDefined();

    renderWithProviders(
      <CartProvider>
        <ProductBuyBox product={product!} />
      </CartProvider>,
    );

    const internal = screen.getAllByRole('link').filter(isInternalAnchor);
    expect(internal.length).toBeGreaterThan(0);
    const offenders = internal.filter((a) => a.getAttribute('data-next-link') !== 'true');
    expect(
      offenders,
      `Internal anchors in ProductBuyBox that bypass next/link Link:\n` +
        offenders
          .map((a) => `  href=${a.getAttribute('href')} text="${a.textContent?.trim()}"`)
          .join('\n'),
    ).toEqual([]);
  });
});
