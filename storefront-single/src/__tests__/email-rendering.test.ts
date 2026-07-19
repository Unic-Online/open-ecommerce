/**
 * Acceptance gate for the email pipeline.
 *
 * Asserts that customer-facing email render functions emit English copy +
 * Acme Store branding + EUR currency + shop.example.com base URL.
 *
 * Also covers the merchant order-email and cart-recovery emails.
 */
import { describe, expect, it } from 'vitest';
import type { OrderItem, ShippingData } from '@/lib/validation';
import type { CartItemData } from '@/lib/types';
import { renderOrderEmail } from '@/lib/emails/order-email';
import { renderCustomerOrderEmail } from '@/lib/emails/customer-order-email';
import {
  renderRecoveryH1,
  renderRecoveryH24,
  renderRecoveryH72,
} from '@/plugins/abandoned-cart/server/emails/cart-recovery';

const SHIPPING_EN: ShippingData = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  phone: '+44 7700 900000',
  address: '1 Example Street',
  city: 'London',
  county: 'Greater London',
  country: 'United Kingdom',
  postalCode: 'SW1A 1AA',
  useAltShipping: false,
  billingType: 'individual',
};

const ITEMS: OrderItem[] = [
  {
    id: 'furniture__oslo-nightstand',
    productType: 'furniture',
    productName: 'Oslo Nightstand',
    unitPrice: 149,
    quantity: 1,
    slug: 'oslo-nightstand',
    shortName: 'Oslo Nightstand',
  },
];

const CART_ITEMS: CartItemData[] = [
  {
    id: 'furniture__oslo-nightstand',
    productType: 'furniture',
    productName: 'Oslo Nightstand',
    unitPrice: 149,
    quantity: 1,
    slug: 'oslo-nightstand',
    shortName: 'Oslo Nightstand',
    image: '',
  },
];

describe('renderCustomerOrderEmail', () => {
  const html = renderCustomerOrderEmail({
    orderId: 'TEST123',
    items: ITEMS,
    shipping: SHIPPING_EN,
    subtotal: 149,
    discount: 30,
    shippingCost: 0,
    totalPrice: 119,
    paymentMethod: 'card',
  });

  it('uses the Acme Store brand', () => {
    expect(html).toContain('Acme Store');
  });

  it('uses the base URL in the footer', () => {
    expect(html).toContain('https://shop.example.com');
  });

  it('uses English body copy', () => {
    expect(html).toContain('Order number');
    expect(html).toContain('Subtotal');
    expect(html).toContain('Welcome discount');
    expect(html).toContain('Delivery');
    expect(html).toContain('Your products');
  });

  it('formats prices in EUR', () => {
    expect(html).toMatch(/€/);
    expect(html).not.toMatch(/\bRON\b/);
  });

  it('does not advertise WhatsApp (market has no agent)', () => {
    expect(html).not.toContain('WhatsApp');
  });
});

describe('renderOrderEmail (merchant)', () => {
  it('uses Acme Store brand and base URL', () => {
    const html = renderOrderEmail({
      orderId: 'TEST789',
      items: ITEMS,
      shipping: SHIPPING_EN,
      shippingCost: 0,
      totalPrice: 119,
      paymentMethod: 'card',
    });
    expect(html).toContain('Acme Store');
    expect(html).toContain('https://shop.example.com');
  });

  it('accepts cod payment method', () => {
    const html = renderOrderEmail({
      orderId: 'TEST790',
      items: ITEMS,
      shipping: SHIPPING_EN,
      shippingCost: 0,
      totalPrice: 119,
      paymentMethod: 'cod',
    });
    expect(html).toContain('Acme Store');
  });
});

describe('renderRecovery{H1,H24,H72}', () => {
  const baseParams = {
    recoveryUrl: 'https://shop.example.com/recover/test-token',
    items: CART_ITEMS,
    firstName: 'Alice',
    couponCode: 'SHOP-EN01-AB12',
    couponDiscountPercent: 10,
  };

  it('H1: English subject + body, EUR price', () => {
    const { subject, html } = renderRecoveryH1(baseParams);
    expect(subject).toMatch(/basket/i);
    expect(html).toContain('Continue my order');
    expect(html).toContain('Hello Alice');
    expect(html).toMatch(/€/);
    expect(html).toContain('Acme Store');
    expect(html).toContain('shop.example.com');
  });

  it('H24: English subject with discount, coupon copy', () => {
    const { subject, html } = renderRecoveryH24(baseParams);
    expect(subject).toContain('10%');
    expect(subject).toMatch(/discount/i);
    expect(html).toContain('SHOP-EN01-AB12');
    expect(html).toContain('Use the code');
  });

  it('H72: English final-warning copy', () => {
    const { subject, html } = renderRecoveryH72(baseParams);
    expect(subject).toMatch(/last chance/i);
    expect(html).toContain('Recover my basket');
  });

  it('shell footer does not advertise WhatsApp', () => {
    const { html } = renderRecoveryH1(baseParams);
    expect(html).not.toContain('WhatsApp');
  });
});
