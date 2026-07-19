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

// `@/lib/nav` re-exports next/link + next/navigation and a `hrefFor` helper.
// Mirror the next/link + next/navigation mocks above so storefront components
// that import from `@/lib/nav` work in unit tests.
vi.mock('@/lib/nav', () => ({
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
  notFound: vi.fn(),
  // Interpolate `[param]` segments into a concrete URL string.
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
