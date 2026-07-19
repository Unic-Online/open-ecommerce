'use client';

import { useEffect, useRef } from 'react';
import { useCart } from '@/lib/cart-context';
import { isValidEmail, storeEmail } from '@/lib/email-capture';
import { abandonedCartConfig } from '../config';
import { CART_COOKIE_NAME } from '../shared/types';

const SYNC_DEBOUNCE_MS = 800;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(
      '(?:^|;\\s*)' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '=([^;]+)',
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __sfConsent?: { marketing?: boolean } };
  return w.__sfConsent?.marketing === true;
}

function botCheckToken(): string {
  try {
    return btoa(`${navigator.userAgent.slice(0, 64)}:${Date.now()}`).slice(0, 96);
  } catch {
    return `fallback-${Date.now()}`;
  }
}

interface Props {
  email: string;
  phone: string;
}

/**
 * Mirror /checkout email + phone to the cart doc as the user types, so
 * abandonment recovery has contact info even when the user bounces before
 * hitting "Continue to payment". Sibling to <CartSync />, but watches the
 * form fields directly and writes the same /api/cart/sync endpoint.
 *
 * Renders nothing.
 */
export default function CheckoutContactSync({ email, phone }: Props) {
  const { items, totalPrice } = useCart();
  const lastSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (!abandonedCartConfig.cartSync) return;
    // Why: typing an email at /checkout with an empty cart used to create
    // noise 'recovered' rows. No items = nothing the recovery cron can
    // possibly act on, so don't persist a contact-only stub.
    if (items.length === 0) return;
    const trimmedPhone = phone.trim();
    const validEmail = isValidEmail(email);
    if (!validEmail && trimmedPhone.length < 6) return;

    // Skip if the relevant fields haven't changed since the last successful
    // sync. items + totalPrice are tracked too because adding a product to
    // cart while at /checkout should re-bind the contact info.
    const snapshot = JSON.stringify({
      email: validEmail ? email : '',
      phone: trimmedPhone,
      itemCount: items.length,
      totalPrice,
    });
    if (snapshot === lastSnapshotRef.current) return;

    const handle = setTimeout(() => {
      const cartId = readCookie(CART_COOKIE_NAME) ?? undefined;

      // Persist email locally too — CartSync, ExitIntentPopup, and the
      // recovery email gate all read from this storage slot.
      if (validEmail) storeEmail(email);

      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          items,
          subtotal: totalPrice,
          ...(validEmail ? { email } : {}),
          ...(trimmedPhone ? { phone: trimmedPhone } : {}),
          marketingConsent: getMarketingConsent(),
          botCheck: botCheckToken(),
        }),
      })
        .then((res) => {
          if (res.ok) lastSnapshotRef.current = snapshot;
        })
        .catch(() => {
          /* network blip — next change will retry */
        });
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [email, phone, items, totalPrice]);

  return null;
}
