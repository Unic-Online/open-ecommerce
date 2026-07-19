/**
 * The merchant order email must show amounts in the ORDER's currency.
 * Regression: `renderOrderEmail` formatted every amount with the legacy
 * RO-only `formatPrice` ("<n> RON") and hardcoded "RON" next to the totals,
 * so an english-market order (charged in EUR) reached the merchant inbox
 * as "<n> RON" — wrong by a factor of the FX rate. Merchant copy stays
 * Romanian by design; only the money must follow the market.
 */
import { describe, it, expect } from 'vitest';
import { renderOrderEmail } from '@/lib/emails/order-email';
import { buildShipping, buildOrderLine } from './helpers/builders';

const SHIPPING = buildShipping();
const ITEMS = [buildOrderLine({ unitPrice: 149 })];

describe('renderOrderEmail — currency follows the order market', () => {
  it('english market: amounts in EUR, no RON anywhere', () => {
    const html = renderOrderEmail({
      orderId: 'TESTEN01',
      items: ITEMS,
      shipping: SHIPPING,
      shippingCost: 10,
      totalPrice: 144,
      paymentMethod: 'card',
      market: 'english',
    });
    expect(html).toMatch(/€/);
    expect(html).not.toMatch(/\bRON\b/);
  });

  it('ro market: amounts still in RON', () => {
    const html = renderOrderEmail({
      orderId: 'TESTRO01',
      items: ITEMS,
      shipping: SHIPPING,
      shippingCost: 29,
      totalPrice: 163,
      paymentMethod: 'ramburs',
      market: 'ro',
    });
    expect(html).toMatch(/RON/);
    expect(html).not.toMatch(/€/);
  });
});
