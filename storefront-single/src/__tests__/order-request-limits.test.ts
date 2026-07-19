import { describe, expect, it } from 'vitest';
import { orderRequestSchema, cartSyncSchema } from '@/lib/validation';
import { buildShipping, buildCartItem } from './helpers/builders';

// Server-trust: quantity and line count come straight off the wire and feed
// the charged totals (`computeOrderTotal`), the Revolut amount
// (`toMinorUnits`), the persisted doc, the emails, and the Meta CAPI Purchase
// value. Without an upper bound, `quantity: 1e15` passes `.int().positive()`
// and produces a "real" order whose totalPrice overflows safe integer
// arithmetic and corrupts every downstream consumer.

function orderBody(extra: Record<string, unknown> = {}) {
  return {
    shipping: buildShipping(),
    items: [buildCartItem()],
    ...extra,
  };
}

describe('orderRequestSchema quantity/items bounds', () => {
  it('rejects an absurd line quantity', () => {
    const result = orderRequestSchema.safeParse(
      orderBody({ items: [buildCartItem({ quantity: 1000 })] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a non-finite-scale quantity (1e15)', () => {
    const result = orderRequestSchema.safeParse(
      orderBody({ items: [buildCartItem({ quantity: 1_000_000_000_000_000 })] }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts a large-but-sane quantity (999)', () => {
    const result = orderRequestSchema.safeParse(
      orderBody({ items: [buildCartItem({ quantity: 999 })] }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects more than 50 line items (cart-sync parity)', () => {
    const items = Array.from({ length: 51 }, () => buildCartItem());
    const result = orderRequestSchema.safeParse(orderBody({ items }));
    expect(result.success).toBe(false);
  });

  it('accepts 50 line items', () => {
    const items = Array.from({ length: 50 }, () => buildCartItem());
    const result = orderRequestSchema.safeParse(orderBody({ items }));
    expect(result.success).toBe(true);
  });
});

describe('cartSyncSchema inherits the quantity bound', () => {
  it('rejects an absurd quantity in a cart sync', () => {
    const result = cartSyncSchema.safeParse({
      items: [buildCartItem({ quantity: 1000 })],
      subtotal: 149,
      botCheck: 'abc123',
    });
    expect(result.success).toBe(false);
  });
});
