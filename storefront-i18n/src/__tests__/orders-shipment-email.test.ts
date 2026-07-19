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

const roOrder: OrderDoc = {
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
      unitPrice: 749,
      currency: 'RON',
      slug: 'oslo-nightstand',
      shortName: 'Oslo Nightstand',
      image: '',
    },
  ],
  subtotal: 749,
  discount: 0,
  shippingCost: 0,
  totalPrice: 749,
  paymentMethod: 'card',
  status: 'paid',
  market: 'ro',
  locale: 'ro',
  currency: 'RON',
  marketingConsent: true,
  fulfillment: { status: 'shipped', carrier: 'Sameday', trackingNumber: '2826XX99' },
  createdAt: new Date('2026-05-01T08:00:00Z'),
  updatedAt: new Date('2026-05-01T08:00:00Z'),
};

// english market order (EUR, locale 'en')
const enOrder: OrderDoc = {
  ...roOrder,
  orderId: 'ENDEF567',
  market: 'english',
  locale: 'en',
  currency: 'EUR',
  totalPrice: 149,
  shipping: { ...baseShipping, country: 'GB' },
};

describe('shipmentEmailSubject', () => {
  it('uses RO copy for ro locale', () => {
    expect(shipmentEmailSubject(roOrder)).toBe('Comanda ta a fost expediată — #ABCD1234');
  });
  it('uses EN copy for en locale', () => {
    expect(shipmentEmailSubject(enOrder)).toBe(
      'Your order has been dispatched — #ENDEF567',
    );
  });
});

describe('renderShipmentEmail', () => {
  it('includes the carrier and tracking number when present', () => {
    const html = renderShipmentEmail({ order: roOrder });
    expect(html).toContain('Sameday');
    expect(html).toContain('2826XX99');
    expect(html).toContain('#ABCD1234');
    expect(html).toContain('Oslo Nightstand');
  });

  it('uses Acme Store branding for english market', () => {
    const html = renderShipmentEmail({ order: enOrder });
    expect(html).toContain('Acme Store');
  });

  it('shows the no-tracking fallback when AWB is missing', () => {
    const noTracking: OrderDoc = {
      ...roOrder,
      fulfillment: { status: 'shipped', carrier: 'Sameday' },
    };
    const html = renderShipmentEmail({ order: noTracking });
    expect(html).toContain('comunicat în scurt timp');
  });

  it('escapes HTML in customer-supplied fields', () => {
    const evil: OrderDoc = {
      ...roOrder,
      shipping: { ...baseShipping, firstName: '<script>alert(1)</script>' },
    };
    const html = renderShipmentEmail({ order: evil });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('uses alt-shipping address when useAltShipping is true', () => {
    const altOrder: OrderDoc = {
      ...roOrder,
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
