/**
 * GET /api/account/verify?token=...
 *
 * Validates the magic-link token (HMAC + expiry), atomically consumes the
 * single-use nonce, then issues a session cookie and redirects to
 * /[locale]/account. On any failure, redirects to /[locale]/account?error=...
 * with no cookie set.
 */
import { NextResponse } from 'next/server';
import {
  ACCOUNT_COOKIE_NAME,
  ACCOUNT_COOKIE_MAX_AGE_S,
  createAccountSessionToken,
  verifyMagicLinkToken,
} from '@/lib/account-auth';
import { consumeToken } from '@/lib/account-tokens';

export const dynamic = 'force-dynamic';

function errorRedirect(request: Request, locale: 'ro' | 'fr' | 'en', reason: string) {
  const base = new URL(request.url);
  base.pathname = `/${locale}/account`;
  base.search = `?error=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(base);
}

function successRedirect(request: Request, locale: 'ro' | 'fr' | 'en') {
  const base = new URL(request.url);
  base.pathname = `/${locale}/account`;
  base.search = '';
  return NextResponse.redirect(base);
}

// Fallback locale for errors we hit BEFORE we have a verified token. Reads
// Accept-Language so a French customer who clicks a tampered/missing-token
// link does not land on /ro/account. Falls back to 'ro' (the default market).
function fallbackLocale(request: Request): 'ro' | 'fr' | 'en' {
  const al = request.headers.get('accept-language')?.toLowerCase() ?? '';
  if (al.startsWith('fr') || al.includes(',fr')) return 'fr';
  if (al.startsWith('en') || al.includes(',en')) return 'en';
  return 'ro';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorRedirect(request, fallbackLocale(request), 'missing');

  const decoded = verifyMagicLinkToken(token);
  if (!decoded) return errorRedirect(request, fallbackLocale(request), 'invalid');

  // Atomically consume the nonce — this is what makes the token single-use
  // and immune to replay. If the nonce is gone (already used / never issued),
  // bail without setting a cookie.
  const consumed = await consumeToken(decoded.nonce);
  if (!consumed) return errorRedirect(request, decoded.locale, 'invalid');

  // Trust the server-stored email over the client-submitted payload. They
  // SHOULD match — both are written together at issue — but this is defense
  // in depth.
  const sessionToken = createAccountSessionToken(consumed.email);
  const response = successRedirect(request, decoded.locale);
  response.cookies.set(ACCOUNT_COOKIE_NAME, sessionToken, {
    maxAge: ACCOUNT_COOKIE_MAX_AGE_S,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  });
  return response;
}
