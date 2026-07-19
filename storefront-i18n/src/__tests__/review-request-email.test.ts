import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  renderReviewRequestEmail,
  reviewRequestEmailSubject,
} from '@/lib/emails/review-request';
import { verifyReviewToken } from '@/lib/orders/review-token';
import type { OrderDoc } from '@/lib/orders/types';

// Each CTA is signed via signReviewToken, which needs the shared HMAC secret.
const SECRET = 'test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod';
let originalSecret: string | undefined;
beforeEach(() => {
  originalSecret = process.env.CART_RECOVERY_HMAC_SECRET;
  process.env.CART_RECOVERY_HMAC_SECRET = SECRET;
});
afterEach(() => {
  if (originalSecret === undefined) delete process.env.CART_RECOVERY_HMAC_SECRET;
  else process.env.CART_RECOVERY_HMAC_SECRET = originalSecret;
});

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
  fulfillment: { status: 'delivered', deliveredAt: new Date('2026-06-20T00:00:00Z') },
  createdAt: new Date('2026-06-01T08:00:00Z'),
  updatedAt: new Date('2026-06-20T08:00:00Z'),
};

const enOrder: OrderDoc = {
  ...roOrder,
  orderId: 'ENDEF567',
  market: 'english',
  locale: 'en',
  currency: 'EUR',
  totalPrice: 249,
  shipping: { ...baseShipping, country: 'GB' },
};

describe('reviewRequestEmailSubject', () => {
  it('names the product when the order has a single distinct product (RO)', () => {
    expect(reviewRequestEmailSubject(roOrder)).toBe(
      'Cum ți se pare Oslo Nightstand? Lasă o recenzie',
    );
  });

  it('falls back to a generic subject for multi-product orders', () => {
    const multi: OrderDoc = {
      ...roOrder,
      items: [
        roOrder.items[0],
        { ...roOrder.items[0], id: 'furniture__aria-console', slug: 'aria-console', productName: 'Aria Console' },
      ],
    };
    expect(reviewRequestEmailSubject(multi)).toBe(
      'Cum ți se par produsele tale? Lasă o recenzie',
    );
  });

  it('uses EN copy for en locale', () => {
    expect(reviewRequestEmailSubject(enOrder)).toBe(
      'How do you like Oslo Nightstand? Leave a review',
    );
  });
});

describe('renderReviewRequestEmail', () => {
  it('links the CTA to the product page reviews anchor (#recenzii), signed with ?rt=', () => {
    const html = renderReviewRequestEmail({ order: roOrder });
    expect(html).toMatch(/https:\/\/ro\.shop\.example\.com\/mobilier\/oslo-nightstand\?rt=[^"&#]+#recenzii/);
  });

  it('renders one CTA per distinct product, not per unit (qty collapses)', () => {
    const threeUnits: OrderDoc = {
      ...roOrder,
      items: [{ ...roOrder.items[0], quantity: 3 }],
    };
    const html = renderReviewRequestEmail({ order: threeUnits });
    const occurrences = html.split('#recenzii').length - 1;
    expect(occurrences).toBe(1);
  });

  it('renders a CTA per distinct product for a multi-product order', () => {
    const multi: OrderDoc = {
      ...roOrder,
      items: [
        roOrder.items[0],
        { ...roOrder.items[0], id: 'furniture__aria-console', slug: 'aria-console', productName: 'Aria Console' },
      ],
    };
    const html = renderReviewRequestEmail({ order: multi });
    expect(html).toMatch(/https:\/\/ro\.shop\.example\.com\/mobilier\/oslo-nightstand\?rt=[^"&#]+#recenzii/);
    expect(html).toMatch(/https:\/\/ro\.shop\.example\.com\/mobilier\/aria-console\?rt=[^"&#]+#recenzii/);
    expect(html).toContain('Oslo Nightstand');
    expect(html).toContain('Aria Console');
  });

  it('uses the EN market baseUrl and localized category path', () => {
    const html = renderReviewRequestEmail({ order: enOrder });
    expect(html).toMatch(/https:\/\/shop\.example\.com\/furniture\/oslo-nightstand\?rt=[^"&#]+#recenzii/);
  });

  it('uses the market brand name for the header and sign-off (de-branded — no hardcoded name)', () => {
    const html = renderReviewRequestEmail({ order: roOrder });
    expect(html).toContain('Acme Store');
    expect(html).toContain('Echipa Acme Store');
  });

  it('never mentions a discount — this is a service email, not marketing', () => {
    const html = renderReviewRequestEmail({ order: roOrder });
    expect(html.toLowerCase()).not.toMatch(/reducere|discount|cod promo|% ?off/);
  });

  it('includes the market contact email', () => {
    const html = renderReviewRequestEmail({ order: roOrder });
    expect(html).toContain('contact@example.com');
  });

  it('the ?rt= token verifies to the correct orderId + slug', () => {
    const html = renderReviewRequestEmail({ order: roOrder });
    const match = html.match(/\?rt=([^"&#]+)#recenzii/);
    expect(match).not.toBeNull();
    const token = decodeURIComponent(match![1]);
    expect(verifyReviewToken(token)).toMatchObject({
      valid: true,
      orderId: 'ABCD1234',
      slug: 'oslo-nightstand',
    });
  });

  it('escapes HTML in customer-supplied fields', () => {
    const evil: OrderDoc = {
      ...roOrder,
      shipping: { ...baseShipping, firstName: '<script>alert(1)</script>' },
    };
    const html = renderReviewRequestEmail({ order: evil });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
