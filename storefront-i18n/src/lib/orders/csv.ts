/**
 * CSV serialization for orders. Pure — safe to import client-side.
 *
 * Invariants:
 *   - Cells starting with `=`, `+`, `-`, `@`, tab, or CR are prefixed with a
 *     leading apostrophe to defuse Excel formula injection (CWE-1236). The
 *     apostrophe gets stripped by Excel on display but blocks formula
 *     evaluation. Tab and CR receive the same treatment because Excel's
 *     formula parser accepts them as leaders.
 *   - Quoting follows RFC 4180: a cell is wrapped in `"` if it contains
 *     `,`, `"`, `\n`, or `\r`; embedded `"` doubled to `""`.
 *   - Dates serialize as ISO-8601 UTC; numbers are emitted raw (no currency
 *     symbol — currency lives in its own column so RON/EUR rows can be
 *     filtered or summed in a spreadsheet).
 * Side effects: none.
 */
import type { OrderDoc } from './types';

const FORMULA_LEADERS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : String(value);

  // Defuse Excel/Google Sheets formula injection. Must run before the
  // RFC-4180 quoting wrap so the apostrophe ends up *inside* the quotes.
  const guarded = raw.length > 0 && FORMULA_LEADERS.has(raw[0]) ? `'${raw}` : raw;

  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export const CSV_COLUMNS = [
  'orderId',
  'createdAt',
  'status',
  'paymentMethod',
  'market',
  'locale',
  'currency',
  'subtotal',
  'discount',
  'shippingCost',
  'totalPrice',
  'email',
  'firstName',
  'lastName',
  'phone',
  'country',
  'county',
  'city',
  'address',
  'postalCode',
  'fulfillmentStatus',
  'carrier',
  'trackingNumber',
  'shippedAt',
  'refundAmount',
  'refundedAt',
  'couponCode',
  'cartId',
] as const;

export const CSV_HEADER = CSV_COLUMNS.join(',');

export function toCsvRow(o: OrderDoc): string {
  const cells = [
    o.orderId,
    o.createdAt,
    o.status,
    o.paymentMethod,
    o.market,
    o.locale,
    o.currency,
    o.subtotal,
    o.discount,
    o.shippingCost,
    o.totalPrice,
    o.email,
    o.shipping?.firstName,
    o.shipping?.lastName,
    o.shipping?.phone,
    o.shipping?.country,
    o.shipping?.county,
    o.shipping?.city,
    o.shipping?.address,
    o.shipping?.postalCode,
    o.fulfillment?.status ?? 'unfulfilled',
    o.fulfillment?.carrier,
    o.fulfillment?.trackingNumber,
    o.fulfillment?.shippedAt,
    o.refund?.amount,
    o.refund?.refundedAt,
    o.couponCode,
    o.cartId,
  ];
  return cells.map(escapeCsvCell).join(',');
}
