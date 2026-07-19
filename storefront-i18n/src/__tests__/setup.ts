/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/script', () => ({
  default: () => null,
}));

// `after()` requires Next.js's request-scope AsyncLocalStorage, which isn't
// set up when route handlers are invoked directly from vitest. Replace it
// with an immediate-invoke stub so tests can assert on after-scheduled side
// effects without re-implementing the request machinery. NextResponse and
// other production exports pass through untouched.
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (cb: () => unknown) => {
      try {
        const result = cb();
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(() => {});
        }
      } catch {
        /* swallow — tests assert on mock invocations, not throws */
      }
    },
  };
});

// next/headers cookies()/headers() rely on request-scope AsyncLocalStorage
// which isn't populated when route handlers are invoked directly from
// tests. Default to empty cookies/headers; individual tests can override.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    has: vi.fn(() => false),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.priority;
    delete imageProps.quality;
    return React.createElement('img', imageProps);
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return React.createElement('a', { href, ...props }, children);
  },
}));

// next-intl wraps Link/useRouter/usePathname/redirect via createNavigation.
// Mirror the next/link + next/navigation mocks above so storefront
// components that import from `@/i18n/navigation` work in unit tests.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return React.createElement('a', { href, ...props }, children);
  },
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  redirect: vi.fn(),
  // Accepts both the string-href form (`{ href: '/furniture' }`) and the
  // dynamic-pathname form (`{ href: { pathname, params }, locale }`).
  // For the second form we interpolate `[slug]` into the actual value and
  // apply a minimal EN→RO rewrite that mirrors the routing pathnames map
  // for the routes covered by tests. Unknown routes pass through.
  // The pathname KEY is the canonical (en) path; `ro` localizes it.
  getPathname: vi.fn(
    (opts: {
      href:
        | string
        | { pathname: string; params?: Record<string, string | number> };
      locale?: 'ro' | 'en';
    }) => {
      // Category route KEYS are the canonical (en) path; ro localizes them.
      // Static-page route KEYS are already the ro form in routing.ts, so they
      // pass through unchanged for ro.
      const RO_PATHS: Record<string, string> = {
        '/furniture': '/mobilier',
        '/furniture/[slug]': '/mobilier/[slug]',
        '/lighting': '/iluminat',
        '/lighting/[slug]': '/iluminat/[slug]',
        '/outdoor': '/exterior',
        '/outdoor/[slug]': '/exterior/[slug]',
      };
      let pathname: string;
      let params: Record<string, string | number> | undefined;
      if (typeof opts.href === 'string') {
        pathname = opts.href;
      } else {
        pathname = opts.href.pathname;
        params = opts.href.params;
      }
      let resolved = opts.locale === 'ro' ? RO_PATHS[pathname] ?? pathname : pathname;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          resolved = resolved.replace(`[${k}]`, String(v));
        }
      }
      return resolved;
    },
  ),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Hygiene: the mock above is module-scoped, so without this reset every key
// written by one test would leak into the next test in the same file. Wipe
// the backing store after each test (mock call history is wiped separately
// by `clearMocks` in vitest.config.ts), plus jsdom's real sessionStorage.
afterEach(() => {
  localStorageMock.clear();
  window.sessionStorage.clear();
});
