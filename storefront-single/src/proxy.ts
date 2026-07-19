// Next.js 16 renamed `middleware.ts` to `proxy.ts`. Single responsibility now:
//
//   Feature-flag gating (server-side, single seam): when a `features.*` flag is
//   off, the whole route tree it owns 404s here — before any route code runs —
//   so a disabled feature is fully inert. Covered trees:
//     - admin        → /admin/**      + /api/admin/**
//     - accounts     → /account       + /api/account/**
//     - merchantFeed → /google-merchant.xml
//     - abandonedCart→ /api/cron/cart-recovery + /api/cart/recover/** + sync
//     - analytics    → /api/meta-capi + /api/cron/meta-capi-replay
//
// This is the single-language template: there is no locale middleware, so
// every non-flagged path simply falls through to the route handlers.
import { NextResponse, type NextRequest } from 'next/server';
import { features } from './site.config';

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

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isFlaggedOff(pathname)) {
    return notFound();
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals + static files, so the flag gate
  // can see /admin, /api/admin, /google-merchant.xml, etc.
  matcher: '/((?!_next|_vercel).*)',
};
