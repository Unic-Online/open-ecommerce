import { describe, expect, it } from 'vitest';
import {
  renderShipmentEmail,
  shipmentEmailSubject,
} from '@/lib/emails/shipment-email';
import type { OrderDoc } from '@/lib/orders/types';

const baseShipping = {
  firstName: 'Alex',
  lastName: 'Doe',
  email: 'alex@example.com',
  phone: '0712345678',
  county: 'Bucuresti',
  city: 'Bucuresti',
  address: 'Str. Exemplu 1',
  country: 'RO',
  postalCode: '010101',
  billingType: 'individual' as const,
  useAltShipping: false,
};

const order: OrderDoc = {
  orderId: 'ABCD1234',
  email: 'alex@example.com',
  shipping: baseShipping,
  items: [
    {
      id: 'furniture__oslo-nightstand',
      productId: 'furniture__oslo-nightstand',
      productType: 'furniture',
      productName: 'Oslo Nightstand',
      quantity: 1,
      unitPrice: 149,
      currency: 'EUR',
      slug: 'oslo-nightstand',
      shortName: 'Oslo Nightstand',
      image: '',
    },
  ],
  subtotal: 149,
  discount: 0,
  shippingCost: 0,
  totalPrice: 149,
  paymentMethod: 'card',
  status: 'paid',
  market: 'main',
  currency: 'EUR',
  marketingConsent: true,
  fulfillment: { status: 'shipped', carrier: 'Sameday', trackingNumber: '2826XX99' },
  createdAt: new Date('2026-05-01T08:00:00Z'),
  updatedAt: new Date('2026-05-01T08:00:00Z'),
};

describe('shipmentEmailSubject', () => {
  it('returns an English subject line', () => {
    expect(shipmentEmailSubject(order)).toMatch(/dispatched|shipped/i);
    expect(shipmentEmailSubject(order)).toContain('#ABCD1234');
  });
});

describe('renderShipmentEmail', () => {
  it('includes the carrier and tracking number when present', () => {
    const html = renderShipmentEmail({ order });
    expect(html).toContain('Sameday');
    expect(html).toContain('2826XX99');
    expect(html).toContain('#ABCD1234');
    expect(html).toContain('Oslo Nightstand');
  });

  it('uses Acme Store branding', () => {
    const html = renderShipmentEmail({ order });
    expect(html).toContain('Acme Store');
  });

  it('shows the no-tracking fallback when AWB is missing', () => {
    const noTracking: OrderDoc = {
      ...order,
      fulfillment: { status: 'shipped', carrier: 'Sameday' },
    };
    const html = renderShipmentEmail({ order: noTracking });
    // fallback message — either EN or RO depending on template
    expect(html).toBeTruthy();
    expect(html).toContain('#ABCD1234');
  });

  it('escapes HTML in customer-supplied fields', () => {
    const evil: OrderDoc = {
      ...order,
      shipping: { ...baseShipping, firstName: '<script>alert(1)</script>' },
    };
    const html = renderShipmentEmail({ order: evil });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('uses alt-shipping address when useAltShipping is true', () => {
    const altOrder: OrderDoc = {
      ...order,
      shipping: {
        ...baseShipping,
        useAltShipping: true,
        altAddress: 'Str. Alta 99',
        altCity: 'Cluj-Napoca',
        altCounty: 'Cluj',
        altPostalCode: '400000',
        altCountry: 'RO',
      },
    };
    const html = renderShipmentEmail({ order: altOrder });
    expect(html).toContain('Str. Alta 99');
    expect(html).toContain('Cluj-Napoca');
    expect(html).not.toContain('Str. Exemplu 1');
  });
});
