/**
 * Data builders for unit tests — typed factories with sane single-market
 * (main / EUR) defaults and per-field overrides.
 *
 * `buildOrder({ status: 'paid' })` yields a complete `OrderDoc`, so tests stop
 * hand-rolling 30-line literals that silently drift from the real persisted
 * shape.
 *
 * Override semantics are shallow (`{ ...defaults, ...overrides }`): pass a
 * whole `shipping` / `items` value to replace it, built with its own builder.
 *
 * Defaults track the demo catalog's `furniture__oslo-nightstand` (149 EUR):
 * subtotal 149, welcome discount round(149 * 0.10)=15, standard €10 shipping
 * (149 < the €300 free-shipping threshold), total 149 - 15 + 10 = 144.
 */
import type { ShippingData } from '@/lib/validation';
import type { ResolvedCartLine } from '@/lib/cart-resolver';
import type { OrderDoc } from '@/lib/orders/types';
import type { CartDoc } from '@/plugins/abandoned-cart/shared/types';
import type { CartItemData } from '@/lib/types';

export function buildShipping(overrides: Partial<ShippingData> = {}): ShippingData {
  return {
    firstName: 'Ion',
    lastName: 'Popescu',
    email: 'ion@test.ro',
    phone: '+40712345678',
    county: 'Ilfov',
    city: 'București',
    address: 'Str. Test nr. 10',
    country: 'România',
    postalCode: '012345',
    billingType: 'individual',
    useAltShipping: false,
    ...overrides,
  };
}

/** A resolved (server-trusted) order line — the shape persisted on OrderDoc.items. */
export function buildOrderLine(overrides: Partial<ResolvedCartLine> = {}): ResolvedCartLine {
  return {
    id: 'furniture__oslo-nightstand',
    productId: 'furniture__oslo-nightstand',
    quantity: 1,
    unitPrice: 149,
    currency: 'EUR',
    productName: 'Oslo Nightstand',
    image: '/images/oslo-nightstand/1.jpg',
    slug: 'oslo-nightstand',
    shortName: 'Oslo Nightstand',
    productType: 'furniture',
    ...overrides,
  };
}

/** A client-side cart item — the shape stored in `carts.items` / localStorage. */
export function buildCartItem(overrides: Partial<CartItemData> = {}): CartItemData {
  return {
    id: 'furniture__oslo-nightstand',
    productType: 'furniture',
    productName: 'Oslo Nightstand',
    quantity: 1,
    image: '/images/oslo-nightstand/1.jpg',
    unitPrice: 149,
    slug: 'oslo-nightstand',
    shortName: 'Oslo Nightstand',
    ...overrides,
  };
}

/**
 * Complete persisted order. Defaults: single-market (main / EUR) cash-on-delivery
 * Oslo Nightstand order after the 10% welcome discount + standard €10 shipping
 * (149 → subtotal 149, discount 15, shipping 10, total 144).
 */
export function buildOrder(overrides: Partial<OrderDoc> = {}): OrderDoc {
  const now = new Date('2026-06-01T10:00:00.000Z');
  return {
    orderId: 'ABCD1234',
    email: 'ion@test.ro',
    shipping: buildShipping(),
    items: [buildOrderLine()],
    subtotal: 149,
    discount: 15,
    shippingCost: 10,
    totalPrice: 144,
    paymentMethod: 'cod',
    status: 'received',
    market: 'main',
    currency: 'EUR',
    marketingConsent: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Persisted abandoned-cart doc (plugin `carts` collection). */
export function buildCart(overrides: Partial<CartDoc> = {}): CartDoc {
  const now = new Date('2026-06-01T10:00:00.000Z');
  return {
    cartId: '00000000-0000-4000-8000-000000000001',
    email: 'ion@test.ro',
    items: [buildCartItem()],
    subtotal: 149,
    market: 'main',
    marketingConsent: false,
    status: 'abandoned',
    recoveryStep: 0,
    recoveryEmails: [],
    createdAt: now,
    lastActivityAt: now,
    abandonedAt: now,
    ...overrides,
  };
}
