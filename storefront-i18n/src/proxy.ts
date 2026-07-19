// Next.js 16 renamed `middleware.ts` to `proxy.ts`. Two responsibilities:
//
//   1. Feature-flag gating (server-side, single seam): when a `features.*`
//      flag is off, the whole route tree it owns 404s here — before any route
//      code runs — so a disabled feature is fully inert. Covered trees:
//        - admin        → /admin/**      + /api/admin/**
//        - accounts     → /account       + /api/account/**
//        - merchantFeed → /google-merchant.xml
//        - abandonedCart→ /api/cron/cart-recovery + /api/cart/recover/** + sync
//        - analytics    → /api/meta-capi + /api/cron/meta-capi-replay
//      (The localized `/account` path also resolves to `/account` here because
//      next-intl uses the canonical pathname key internally; the RO alias
//      `/cont` is rewritten before this matcher sees it, so we additionally
//      gate the account page at the layout level.)
//
//   2. next-intl locale handling for the public storefront. The factory only
//      runs for non-excluded public paths; admin/api/asset paths short-circuit
//      to `NextResponse.next()` (or a 404 when flagged off).
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { features } from './site.config';

const intlMiddleware = createMiddleware(routing);

function notFound(): NextResponse {
  return new NextResponse('Not Found', { status: 404 });
}

// Path → flag map for whole-tree gating. Order matters: more specific API
// prefixes are checked before the broad page prefixes.
function isFlaggedOff(pathname: string): boolean {
  if (!features.admin && (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin'))) {
    return true;
  }
  if (!features.accounts && (pathname.startsWith('/api/account'))) {
    return true;
  }
  if (!features.merchantFeed && pathname === '/google-merchant.xml') {
    return true;
  }
  if (
    !features.abandonedCart &&
    (pathname.startsWith('/api/cron/cart-recovery') ||
      pathname.startsWith('/api/cart/recover') ||
      pathname.startsWith('/api/cart/sync'))
  ) {
    return true;
  }
  if (
    !features.analytics &&
    (pathname.startsWith('/api/meta-capi') || pathname.startsWith('/api/cron/meta-capi-replay'))
  ) {
    return true;
  }
  return false;
}

// Paths that next-intl must NOT process (it would 404 or wrongly rewrite
// them). Mirrors the old matcher's negative lookahead.
function isNonIntlPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/recover') ||
    pathname.startsWith('/revolut-pay') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    /\.[^/]+$/.test(pathname)
  );
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isFlaggedOff(pathname)) {
    return notFound();
  }

  if (isNonIntlPath(pathname)) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  // Run on everything except Next internals + static files, so the flag gate
  // can see /admin, /api/admin, /google-merchant.xml, etc. The handler itself
  // re-checks and only hands non-excluded public paths to next-intl.
  matcher: '/((?!_next|_vercel).*)',
};
