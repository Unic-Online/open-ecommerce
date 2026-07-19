/**
 * Acceptance gate for the market-aware email pipeline.
 *
 * Asserts that customer-facing email render functions emit English copy +
 * Acme Store branding + EUR currency + shop.example.com base URL when called
 * with `market: 'english'`, and Romanian copy + Acme Store branding + RON
 * + ro.shop.example.com when called with `market: 'ro'` (or the default).
 *
 * Also covers the merchant order-email: brand and base URL track the
 * market, body copy stays Romanian (the merchant team reads it in RO).
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

const SHIPPING_RO: ShippingData = {
  firstName: 'Andrei',
  lastName: 'Popescu',
  email: 'andrei@example.ro',
  phone: '+40 700 000 000',
  address: 'Str. Exemplu 1',
  city: 'București',
  county: 'Sector 1',
  country: 'România',
  postalCode: '012345',
  useAltShipping: false,
  billingType: 'individual',
};

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

describe('renderCustomerOrderEmail — english market', () => {
  const html = renderCustomerOrderEmail({
    orderId: 'TEST123',
    items: ITEMS,
    shipping: SHIPPING_EN,
    subtotal: 149,
    discount: 30,
    shippingCost: 0,
    totalPrice: 119,
    paymentMethod: 'card',
    market: 'english',
  });

  it('uses the Acme Store brand', () => {
    expect(html).toContain('Acme Store');
  });

  it('uses the EN base URL in the footer', () => {
    expect(html).toContain('https://shop.example.com');
    expect(html).not.toContain('ro.shop.example.com');
  });

  it('uses English body copy, not Romanian', () => {
    expect(html).toContain('Order number');
    expect(html).toContain('Subtotal');
    expect(html).toContain('Welcome discount');
    expect(html).toContain('Delivery');
    expect(html).toContain('Your products');
    expect(html).not.toContain('Număr comandă');
    expect(html).not.toContain('Reducere de bun venit');
  });

  it('formats prices in EUR, not RON', () => {
    expect(html).toMatch(/€/);
    expect(html).not.toMatch(/\bRON\b/);
  });

  it('does not advertise WhatsApp (english market has no agent)', () => {
    expect(html).not.toContain('WhatsApp');
  });
});

describe('renderCustomerOrderEmail — RO market', () => {
  const html = renderCustomerOrderEmail({
    orderId: 'TEST456',
    items: ITEMS,
    shipping: SHIPPING_RO,
    subtotal: 749,
    discount: 75,
    shippingCost: 0,
    totalPrice: 674,
    paymentMethod: 'ramburs',
    market: 'ro',
  });

  it('uses Acme Store brand and ro.shop.example.com URL', () => {
    expect(html).toContain('Acme Store');
    expect(html).toContain('ro.shop.example.com');
  });

  it('uses Romanian copy', () => {
    expect(html).toContain('Număr comandă');
    expect(html).toContain('Reducere de bun venit');
  });

  it('formats prices in RON', () => {
    expect(html).toMatch(/RON/);
  });

  it('omits the WhatsApp line when the market has no WhatsApp number', () => {
    // The demo config sets the RO market's whatsappDisplay to '', so the
    // customer email's "Questions? WhatsApp …" line is not rendered.
    expect(html).not.toContain('WhatsApp');
  });
});

describe('renderOrderEmail (merchant) — market-aware brand', () => {
  it('uses Acme Store brand and EN base URL when market=english', () => {
    const html = renderOrderEmail({
      orderId: 'TEST789',
      items: ITEMS,
      shipping: SHIPPING_EN,
      shippingCost: 0,
      totalPrice: 119,
      paymentMethod: 'card',
      market: 'english',
    });
    expect(html).toContain('Acme Store');
    expect(html).toContain('https://shop.example.com');
    expect(html).not.toContain('ro.shop.example.com');
  });

  it('uses Acme Store brand and ro.shop.example.com URL when market=ro', () => {
    const html = renderOrderEmail({
      orderId: 'TEST790',
      items: ITEMS,
      shipping: SHIPPING_RO,
      shippingCost: 0,
      totalPrice: 674,
      paymentMethod: 'card',
      market: 'ro',
    });
    expect(html).toContain('Acme Store');
    expect(html).toContain('ro.shop.example.com');
  });
});

describe('renderRecovery{H1,H24,H72} — english market', () => {
  const baseParams = {
    recoveryUrl: 'https://shop.example.com/recover/test-token',
    items: CART_ITEMS,
    firstName: 'Alice',
    couponCode: 'SHOP-EN01-AB12',
    couponDiscountPercent: 10,
    market: 'english' as const,
  };

  it('H1: English subject + body, no Romanian leakage, EUR price', () => {
    const { subject, html } = renderRecoveryH1(baseParams);
    expect(subject).toMatch(/basket/i);
    expect(html).toContain('Continue my order');
    expect(html).toContain('Hello Alice');
    expect(html).not.toMatch(/Continuă comanda/);
    expect(html).toMatch(/€/);
    expect(html).toContain('Acme Store');
    expect(html).toContain('shop.example.com');
  });

  it('H24: English subject with discount, EN coupon copy', () => {
    const { subject, html } = renderRecoveryH24(baseParams);
    expect(subject).toContain('10%');
    expect(subject).toMatch(/discount/i);
    expect(html).toContain('SHOP-EN01-AB12');
    expect(html).toContain('Use the code');
    expect(html).not.toMatch(/Folosește codul/);
  });

  it('H72: English final-warning copy', () => {
    const { subject, html } = renderRecoveryH72(baseParams);
    expect(subject).toMatch(/last chance/i);
    expect(html).toContain('Recover my basket');
    expect(html).not.toMatch(/Recuperează coșul/);
  });

  it('EN shell footer does not advertise WhatsApp', () => {
    const { html } = renderRecoveryH1(baseParams);
    expect(html).not.toContain('WhatsApp');
  });
});

describe('renderRecoveryH1 — RO market', () => {
  const html = renderRecoveryH1({
    recoveryUrl: 'https://ro.shop.example.com/recover/test-token',
    items: CART_ITEMS,
    firstName: 'Andrei',
    couponCode: 'SHOP-RO01-AB12',
    couponDiscountPercent: 10,
    market: 'ro',
  }).html;

  it('uses Romanian body and Acme Store brand', () => {
    expect(html).toContain('Acme Store');
    expect(html).toContain('Continuă comanda');
    expect(html).toMatch(/RON/);
  });
});
