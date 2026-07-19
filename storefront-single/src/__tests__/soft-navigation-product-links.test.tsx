/**
 * Issue #2 — internal navigation must use next/link Link, not raw <a href>.
 *
 * Raw anchors trigger a full page reload (visible loading bar in the browser).
 * The Link component does client-side soft navigation. Both the breadcrumb
 * (ProductPage) and the category link (ProductBuyBox) point at internal
 * routes (/, /furniture, /lighting, etc.) so they must be Link.
 *
 * Strategy: override the @/lib/nav Link mock from setup.ts so that
 * its rendered <a> carries data-next-link="true". Any anchor in the rendered
 * tree that targets an internal route (href starting with "/") MUST carry
 * that attribute.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithProviders } from './test-utils';
import { CartProvider } from '@/lib/cart-context';

vi.mock('@/lib/nav', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement(
      'a',
      { href, 'data-next-link': 'true', ...props },
      children,
    ),
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  redirect: vi.fn(),
  notFound: vi.fn(),
  hrefFor: (
    href: string | { pathname: string; params?: Record<string, string | number> },
  ) => {
    if (typeof href === 'string') return href;
    let out = href.pathname;
    if (href.params) {
      for (const [k, v] of Object.entries(href.params)) {
        out = out.replace(`[${k}]`, String(v));
      }
    }
    return out;
  },
}));

vi.mock('@/components/product-template/ProductGallery', () => ({ default: () => null }));
vi.mock('@/components/TikTokEmbed', () => ({ default: () => null }));
vi.mock('@/components/reviews/ReviewSection', () => ({ default: () => null }));

import ProductPage from '@/components/product-template/ProductPage';
import ProductBuyBox from '@/components/product-template/ProductBuyBox';
import { getProduct } from '@/lib/catalog';

function isInternalAnchor(el: HTMLElement): boolean {
  const href = el.getAttribute('href') ?? '';
  return href.startsWith('/') && !href.startsWith('//');
}

describe('Issue #2 — internal anchors use next/link Link', () => {
  it('ProductPage breadcrumb items are Next Link (no full reload)', async () => {
    const product = getProduct({ category: 'furniture', slug: 'oslo-nightstand' });
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
    const product = getProduct({ category: 'furniture', slug: 'oslo-nightstand' });
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
