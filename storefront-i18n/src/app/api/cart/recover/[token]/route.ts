import { NextResponse } from 'next/server';
import { verifyRecoveryToken } from '@/plugins/abandoned-cart/server/recovery-token';
import { findCart } from '@/plugins/abandoned-cart/server/carts';
import { validateCoupon } from '@/plugins/abandoned-cart/server/coupons';
import {
  CART_COOKIE_NAME,
  CART_COOKIE_MAX_AGE_DAYS,
} from '@/plugins/abandoned-cart/shared/types';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';

// Server endpoint for the recovery URL. Verifies the HMAC, looks up the
// cart in MongoDB, sets the sf_cart_id cookie, and returns the items so
// the client can hydrate localStorage. The reason code (invalid, missing,
// completed, empty) is mirrored to an x-recover-reason header so the
// client can route the user to the right home-page state.

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ token: string }>;
}

function reject(reason: string, status: number) {
  return NextResponse.json(
    { ok: false, reason },
    { status, headers: { 'x-recover-reason': reason } },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  const verification = verifyRecoveryToken(token);
  if (!verification.valid) {
    return reject(verification.reason === 'expired' ? 'invalid' : 'invalid', 400);
  }

  if (isAbandonedCartDryRun()) {
    // No DB → nothing to recover. The client will redirect home with
    // ?recover=missing, which is the truthful state.
    return reject('missing', 404);
  }

  const cart = await findCart(verification.cartId);
  if (!cart) return reject('missing', 404);
  if (cart.status === 'completed') return reject('completed', 410);
  if (cart.items.length === 0) return reject('empty', 410);

  // If the cart has a coupon attached (issued by step 2 of the recovery
  // funnel), re-validate it now and surface its terms so the client can
  // show "COD APLICAT" with the right discount %.
  let coupon: { code: string; discountPercent: number; validUntil: string; email: string } | null = null;
  if (cart.couponCode && cart.email) {
    const v = await validateCoupon(cart.couponCode, cart.email);
    if (v.valid) {
      coupon = {
        code: cart.couponCode,
        discountPercent: v.discountPercent,
        validUntil: v.validUntil.toISOString(),
        email: v.email,
      };
    }
  }

  const response = NextResponse.json({ ok: true, items: cart.items, coupon });
  response.cookies.set(CART_COOKIE_NAME, verification.cartId, {
    maxAge: CART_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    path: '/',
  });
  return response;
}
