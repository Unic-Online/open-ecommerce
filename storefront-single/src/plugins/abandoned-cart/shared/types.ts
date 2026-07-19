// Shared types for the abandoned-cart plugin.

import type { CartItemData } from '@/lib/types';
import type { MarketKey } from '@/lib/market';
import { storage } from '@/site.config';

export type AbandonedCartFeature =
  | 'exit-intent'
  | 'cart-sync'
  | 'checkout-draft'
  | 'recovery-email'
  | 'coupons'
  | 'admin-dashboard';

// active     — visitor's cart is being filled / browsed
// abandoned  — idle past the abandonment threshold; in the recovery funnel
// recovered  — visitor came back, cleared the cart, or pre-emptied it
// completed  — order placed against this cart; never touched again
export type CartStatus = 'active' | 'abandoned' | 'recovered' | 'completed';

// 0 — no recovery email sent yet
// 1 — H1 sent (no coupon)
// 2 — H24 sent (with coupon)
// 3 — H72 sent (final)
export type RecoveryStep = 0 | 1 | 2 | 3;

export interface CartDoc {
  cartId: string; // UUID, mirrored to client cookie
  email?: string; // lowercased
  phone?: string;
  items: CartItemData[];
  subtotal: number;
  // Phase 3: commercial market the cart was created on. Optional because
  // pre-Phase-3 docs lack the field — readers fall back to 'ro' (the only
  // market that existed at the time).
  market?: MarketKey;
  ipAddress?: string;
  userAgent?: string;
  marketingConsent: boolean;
  status: CartStatus;
  recoveryStep: RecoveryStep;
  recoveryEmails: Array<{
    step: 1 | 2 | 3;
    sentAt: Date;
    messageId?: string;
  }>;
  couponCode?: string;
  createdAt: Date;
  lastActivityAt: Date;
  abandonedAt?: Date;
  recoveredAt?: Date;
  completedAt?: Date;
  orderId?: string;
}

// Cookie that carries the cartId across requests. Not httpOnly because the
// client needs to read it for sync POSTs and to display recovery state.
export const CART_COOKIE_NAME = storage.cookie.cartId;
export const CART_COOKIE_MAX_AGE_DAYS = 90;

export const CARTS_COLLECTION = 'carts';
export const COUPONS_COLLECTION = 'cart_coupons';

// One-shot, email-restricted coupon issued during the recovery sequence.
// Stacks on top of the default 10% welcome discount in pricing.ts.
export interface CouponDoc {
  code: string;             // 'SHOP-XXXX-XXXX'
  cartId: string;
  email: string;            // restriction — coupon is rejected if billing email differs
  discountPercent: number;  // additional %, stacks on the default welcome discount
  maxUses: 1;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;         // 7 days from issue by default
  createdAt: Date;
  redeemedAt?: Date;
  redeemedOrderId?: string;
}
