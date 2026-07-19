'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAppliedCoupon, storeAppliedCoupon } from '@/lib/applied-coupon';
import { storeEmail } from '@/lib/email-capture';
import { CART_STORAGE_KEY } from '@/lib/cart-context';
import { refreshItemsForMarket } from '@/lib/cart-price-validator';
import type { CartItemData } from '@/lib/types';

interface RecoverApiResponse {
  items: unknown[];
  coupon?: {
    code: string;
    discountPercent: number;
    validUntil: string;
    email?: string;
  } | null;
}

interface Props {
  token: string;
  // The cart page path to route to after a successful recovery.
  cartPath: string;
  // Loading text shown while the recovery API call is in flight.
  loadingText: string;
}

/**
 * Calls the recovery API, writes the recovered items to localStorage, and
 * routes to the cart page (`/cart`). The API sets the sf_cart_id cookie via
 * Set-Cookie so the server pins the cartId for subsequent /api/cart/sync
 * requests.
 *
 * Why direct localStorage write: we write to the same key CartProvider reads
 * on hydration; the destination page picks the items up, runs the same
 * normalize + market-price filter loadCart() does, and the cart appears with
 * no extra plumbing.
 *
 * Why a hard navigation (window.location) to the cart page: CartProvider is
 * mounted in the ROOT layout, which also wraps /recover. It hydrates from
 * (empty) localStorage on first paint, BEFORE this client writes the recovered
 * items, and a soft router.replace() keeps the same provider instance — so it
 * never re-reads the freshly written cart and the destination shows an empty
 * basket. A full document navigation remounts CartProvider so loadCart() picks
 * up the recovered items.
 *
 * On any failure (invalid token, missing cart, completed cart, empty cart)
 * the API encodes the reason in a status header and we redirect home with
 * a matching ?recover=… query.
 */
export default function RecoverClient({ token, cartPath, loadingText }: Props) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/cart/recover/${encodeURIComponent(token)}`, {
          method: 'GET',
        });
        if (cancelled) return;
        if (!res.ok) {
          const reason = res.headers.get('x-recover-reason') || 'invalid';
          router.replace(`/?recover=${reason}`);
          return;
        }
        const data = (await res.json()) as RecoverApiResponse;
        if (Array.isArray(data.items)) {
          // Re-price against current market BEFORE writing. loadCart() on
          // the destination page drops items whose stored unitPrice doesn't
          // match the current price, so a stale snapshot from the recovery
          // email would silently shrink the cart on a sale boundary if we
          // wrote raw items.
          const refreshed = refreshItemsForMarket(data.items as CartItemData[]);
          try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(refreshed));
          } catch {
            /* storage full or denied — destination page just sees an empty cart */
          }
        }
        // Persist the recovery coupon so /comanda + /checkout can show
        // "COD APLICAT" and stack the discount over the default 10%.
        if (data.coupon && data.coupon.code) {
          storeAppliedCoupon({
            code: data.coupon.code,
            discountPercent: data.coupon.discountPercent,
            validUntil: data.coupon.validUntil,
            email: data.coupon.email,
          });
          // Pin the coupon's email as the user's email too so /checkout
          // pre-fills with it. The coupon is email-locked at redemption,
          // so any other email at checkout would silently lose the
          // discount.
          if (data.coupon.email) storeEmail(data.coupon.email);
        } else {
          clearAppliedCoupon();
        }
        // Hard navigation: remount CartProvider so it re-reads the cart we
        // just wrote (see the why-hard-nav note in the component docblock).
        window.location.assign(cartPath);
      } catch {
        if (!cancelled) router.replace('/?recover=invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router, cartPath]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body), sans-serif',
        color: '#4a4a4a',
        fontSize: '0.95rem',
      }}
    >
      {loadingText}
    </div>
  );
}
