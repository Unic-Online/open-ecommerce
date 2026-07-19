/**
 * HTML-injection regression for the order emails.
 *
 * `shipping.*` is customer-typed free text (the Zod schema only enforces
 * non-emptiness), and both `renderCustomerOrderEmail` and the merchant
 * `renderOrderEmail` interpolated it straight into the HTML body. A buyer
 * could inject arbitrary markup into the confirmation email — and, far
 * worse, into the MERCHANT notification inbox (phishing content rendered
 * from our own sender domain). The shipment + contact + cart-recovery
 * templates already escape; these two must too.
 */
import { describe, it, expect } from 'vitest';
import { renderCustomerOrderEmail } from '@/lib/emails/customer-order-email';
import { renderOrderEmail } from '@/lib/emails/order-email';
import { buildShipping, buildOrderLine } from './helpers/builders';

const XSS = '<img src=x onerror=alert(1)>';

const HOSTILE_SHIPPING = buildShipping({
  firstName: XSS,
  lastName: '<script>steal()</script>',
  email: 'attacker@example.com',
  phone: '0712345678<b>x</b>',
  address: '"><iframe src=//evil.example></iframe>',
  city: '<u>City</u>',
  county: '<i>County</i>',
  country: 'RO<svg/onload=1>',
  postalCode: '0123<wbr>45',
});

const HOSTILE_ITEMS = [
  buildOrderLine({
    productName: `Oslo ${XSS}`,
    shortName: '<b>Oslo</b>',
  }),
];

const RAW_PAYLOADS = [
  XSS,
  '<script>',
  '<iframe',
  '<svg/onload=1>',
  '<u>City</u>',
  '<i>County</i>',
  '<b>Oslo</b>',
  '<wbr>',
];

describe('renderCustomerOrderEmail — escapes user-controlled fields', () => {
  const html = renderCustomerOrderEmail({
    orderId: 'ABCD1234',
    items: HOSTILE_ITEMS,
    shipping: HOSTILE_SHIPPING,
    subtotal: 149,
    discount: 15,
    shippingCost: 0,
    totalPrice: 134,
    paymentMethod: 'cod',
  });

  it('never emits raw customer-supplied markup', () => {
    for (const payload of RAW_PAYLOADS) {
      expect(html).not.toContain(payload);
    }
  });

  it('keeps the (escaped) text content visible', () => {
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });
});

describe('renderOrderEmail (merchant) — escapes user-controlled fields', () => {
  const html = renderOrderEmail({
    orderId: 'ABCD1234',
    items: HOSTILE_ITEMS,
    shipping: HOSTILE_SHIPPING,
    shippingCost: 0,
    totalPrice: 134,
    paymentMethod: 'cod',
  });

  it('never emits raw customer-supplied markup', () => {
    for (const payload of RAW_PAYLOADS) {
      expect(html).not.toContain(payload);
    }
  });

  it('keeps the (escaped) text content visible', () => {
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });
});
