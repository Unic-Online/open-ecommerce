'use client';

import { useEffect, useRef } from 'react';
import { useCart } from '@/lib/cart-context';
import { getStoredEmail } from '@/lib/email-capture';
import { abandonedCartConfig } from '../config';
import { CART_COOKIE_NAME } from '../shared/types';

const SYNC_DEBOUNCE_MS = 600;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '=([^;]+)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __sfConsent?: { marketing?: boolean } };
  return w.__sfConsent?.marketing === true;
}

function botCheckToken(): string {
  // Trivial token — the server doesn't decode it. Bots that don't run JS
  // simply won't produce one, which is the actual signal we care about.
  try {
    return btoa(`${navigator.userAgent.slice(0, 64)}:${Date.now()}`).slice(0, 96);
  } catch {
    return `fallback-${Date.now()}`;
  }
}

/**
 * Mounts a debounced sync from the local cart context to /api/cart/sync.
 * Renders nothing.
 *
 * Behaviour:
 *   - Skips entirely when the cart-sync feature flag is off
 *   - Debounces 600 ms after the last cart change to coalesce rapid
 *     quantity adjustments into one POST
 *   - Tracks the last successful sync via a snapshot hash to avoid
 *     re-POSTing identical payloads (cart-context's mount triggers a
 *     re-render with an already-synced state)
 */
export default function CartSync() {
  const { items, totalPrice } = useCart();
  const lastSyncedRef = useRef<string>('');

  useEffect(() => {
    if (!abandonedCartConfig.cartSync) return;

    // Why: empty syncs created noise 'recovered' rows for users whose cart
    // was cleared post-purchase or who never had items. The recovery cron
    // can't act on empty carts anyway, so there is nothing to persist.
    if (items.length === 0) return;

    // items array reference flips on every cart-context re-render, even on
    // hydrate-from-storage when contents are identical. Hash to skip those.
    const snapshot = JSON.stringify({ items, totalPrice });
    if (snapshot === lastSyncedRef.current) return;

    const handle = setTimeout(() => {
      const cartId = readCookie(CART_COOKIE_NAME) ?? undefined;
      const email = getStoredEmail() ?? undefined;

      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          items,
          subtotal: totalPrice,
          email,
          marketingConsent: getMarketingConsent(),
          botCheck: botCheckToken(),
        }),
      })
        .then((res) => {
          if (res.ok) {
            lastSyncedRef.current = snapshot;
          }
        })
        .catch(() => {
          /* network blip — next change will retry */
        });
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [items, totalPrice]);

  return null;
}
