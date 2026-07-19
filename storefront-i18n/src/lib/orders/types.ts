/**
 * Domain types for the orders collection. Pure — no runtime imports beyond
 * type-only references to validation and i18n config.
 *
 * Invariants:
 *   - `OrderDoc` mirrors what `saveOrder()` in `lib/contacts.ts` actually
 *     persists, plus the optional admin-side fields (`fulfillment`, `notes`,
 *     `auditLog`, `refund`). Older docs lack the admin fields; readers default
 *     to `unfulfilled` / `[]` / `undefined` — there is no migration.
 *   - `AuditEntry` is a discriminated union on `kind`; new kinds must add a
 *     branch in renderers (see `AuditLogBlock`).
 * Side effects: none.
 */
import type { ShippingData } from '@/lib/validation';
import type { ResolvedCartLine } from '@/lib/cart-resolver';
import type { CurrencyCode, MarketKey } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';
import type { OrderStatus, FulfillmentStatus } from './status-machine';

export const ORDERS_COLLECTION = 'orders';

export interface Fulfillment {
  status: FulfillmentStatus;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  shipmentEmailSentAt?: Date;
  shipmentEmailLastError?: string;
  shipmentEmailLastAttemptAt?: Date;
  /** Post-delivery review-request email — set once, after a successful send. See `@/lib/orders/review-request-cron`. */
  reviewEmailSentAt?: Date;
  reviewEmailLastError?: string;
  reviewEmailLastAttemptAt?: Date;
}

export interface Refund {
  amount: number;
  reason?: string;
  reference?: string;
  refundedAt: Date;
}

export interface OrderNote {
  body: string;
  createdAt: Date;
}

export type AuditEntry =
  | { kind: 'status'; from: OrderStatus; to: OrderStatus; at: Date }
  | { kind: 'fulfillment'; patch: Partial<Fulfillment>; at: Date }
  | { kind: 'note'; body: string; at: Date }
  | { kind: 'refund'; amount: number; reference?: string; at: Date }
  | { kind: 'email_resent'; subject: 'order' | 'shipment'; at: Date }
  | { kind: 'shipping_edit'; prevShipping: ShippingData; at: Date };

export interface OrderPayment {
  provider: 'revolut';
  providerOrderId?: string;
  providerPublicId?: string;
  providerCheckoutUrl?: string;
  state?: string;
  amountMinor?: number;
  currency?: string;
  initiatedAt?: Date;
  paidAt?: Date;
  lastWebhookEvent?: string;
}

export interface MetaCapiPurchaseState {
  /** Set once the Graph API returns 2xx. Absence ⇒ the cron replay considers the order eligible. */
  sentAt?: Date;
  /** Monotonic counter (initial attempt + every retry). Cron stops at MAX_ATTEMPTS to bound noise. */
  attempts: number;
  /** Last non-2xx error code (`not_configured`, `fetch_failed`, `http_400`, …). Cleared on success. */
  lastError?: string;
  /** Timestamp of the last attempt regardless of outcome. */
  lastAttemptAt?: Date;
}

export interface OrderDoc {
  orderId: string;
  email: string;
  shipping: ShippingData;
  items: ResolvedCartLine[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  totalPrice: number;
  paymentMethod: 'ramburs' | 'card';
  status: OrderStatus;
  market: MarketKey;
  locale: LocaleKey;
  currency: CurrencyCode;
  domain?: string;
  marketingConsent: boolean;
  couponCode?: string;
  couponDiscountPercent?: number;
  cartId?: string;
  payment?: OrderPayment;
  emailSentAt?: Date;
  clientIp?: string;
  clientUserAgent?: string;
  experiments?: unknown;
  tracking?: unknown;
  fulfillment?: Fulfillment;
  notes?: OrderNote[];
  auditLog?: AuditEntry[];
  refund?: Refund;
  metaCapi?: { purchase?: MetaCapiPurchaseState };
  testEventCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
