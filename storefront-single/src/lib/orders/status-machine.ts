/**
 * Pure status machine for orders. Client-safe — no DB, no `next/headers`,
 * no Mongo imports.
 *
 * Invariants:
 *   - `OrderStatus` is the closed set of business states an order can be in.
 *     Adding a new state requires updating `ALLOWED_TRANSITIONS` and any
 *     terminal-state guards downstream (notably `updateOrderPayment` in
 *     `lib/contacts.ts` and the confirmare page render switch).
 *   - `ALLOWED_TRANSITIONS` is the single source of truth for legal admin
 *     transitions. The webhook flow may set `paid` / `failed` / `pending_payment`
 *     directly via `updateOrderPayment`; that path is *not* gated by this table.
 *     This table governs only operator-driven transitions through `transitionStatus`.
 *   - Terminal states (`cancelled`, `refunded`) accept no further transitions,
 *     even from the webhook — see `updateOrderPayment`'s `$nin` filter.
 * Side effects: none.
 */

export type OrderStatus =
  | 'received'
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'failed'
  | 'refunded';

export type FulfillmentStatus = 'unfulfilled' | 'shipped' | 'delivered';

export const ORDER_STATUSES: ReadonlyArray<OrderStatus> = [
  'received',
  'pending_payment',
  'paid',
  'cancelled',
  'failed',
  'refunded',
];

export const FULFILLMENT_STATUSES: ReadonlyArray<FulfillmentStatus> = [
  'unfulfilled',
  'shipped',
  'delivered',
];

export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = {
  received: ['paid', 'cancelled', 'refunded'],
  pending_payment: ['paid', 'cancelled', 'failed'],
  paid: ['refunded', 'cancelled'],
  failed: ['cancelled'],
  cancelled: [],
  refunded: [],
};

export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'cancelled',
  'refunded',
]);

export function isAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Inverse of ALLOWED_TRANSITIONS — for each `to`, the set of `from` states
 * that may transition into it. Used by `transitionStatus` to enforce legality
 * inside the Mongo filter (atomically, without a read-then-write race).
 */
export const ALLOWED_FROM: Readonly<Record<OrderStatus, ReadonlyArray<OrderStatus>>> = (() => {
  const inverse: Record<OrderStatus, OrderStatus[]> = {
    received: [],
    pending_payment: [],
    paid: [],
    cancelled: [],
    failed: [],
    refunded: [],
  };
  for (const from of ORDER_STATUSES) {
    for (const to of ALLOWED_TRANSITIONS[from]) {
      inverse[to].push(from);
    }
  }
  return inverse;
})();
