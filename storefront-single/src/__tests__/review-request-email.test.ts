import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  renderReviewRequestEmail,
  reviewRequestEmailSubject,
} from '@/lib/emails/review-request';
import type { OrderDoc } from '@/lib/orders/types';
import { verifyReviewToken } from '@/lib/orders/review-token';
import { buildOrder } from './helpers/builders';

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

const order: OrderDoc = buildOrder({
  fulfillment: { status: 'delivered', deliveredAt: new Date('2026-06-20T00:00:00Z') },
});

describe('reviewRequestEmailSubject', () => {
  it('names the product when the order has a single distinct product', () => {
    expect(reviewRequestEmailSubject(order)).toBe(
      'How do you like Oslo Nightstand? Leave a review',
    );
  });

  it('falls back to a generic subject for multi-product orders', () => {
    const multi: OrderDoc = {
      ...order,
      items: [
        order.items[0],
        { ...order.items[0], id: 'furniture__aria-console', slug: 'aria-console', productName: 'Aria Console' },
      ],
    };
    expect(reviewRequestEmailSubject(multi)).toBe(
      'How do you like your products? Leave a review',
    );
  });
});

describe('renderReviewRequestEmail', () => {
  it('links the CTA to the product page reviews anchor (#recenzii), signed with ?rt=', () => {
    const html = renderReviewRequestEmail({ order });
    expect(html).toMatch(/https:\/\/shop\.example\.com\/furniture\/oslo-nightstand\?rt=[^"&#]+#recenzii/);
  });

  it('renders one CTA per distinct product, not per unit (qty collapses)', () => {
    const threeUnits: OrderDoc = {
      ...order,
      items: [{ ...order.items[0], quantity: 3 }],
    };
    const html = renderReviewRequestEmail({ order: threeUnits });
    const occurrences = html.split('#recenzii').length - 1;
    expect(occurrences).toBe(1);
  });

  it('renders a CTA per distinct product for a multi-product order', () => {
    const multi: OrderDoc = {
      ...order,
      items: [
        order.items[0],
        { ...order.items[0], id: 'furniture__aria-console', slug: 'aria-console', productName: 'Aria Console' },
      ],
    };
    const html = renderReviewRequestEmail({ order: multi });
    expect(html).toMatch(/https:\/\/shop\.example\.com\/furniture\/oslo-nightstand\?rt=[^"&#]+#recenzii/);
    expect(html).toMatch(/https:\/\/shop\.example\.com\/furniture\/aria-console\?rt=[^"&#]+#recenzii/);
    expect(html).toContain('Oslo Nightstand');
    expect(html).toContain('Aria Console');
  });

  it('never mentions a discount — this is a service email, not marketing', () => {
    const html = renderReviewRequestEmail({ order });
    expect(html.toLowerCase()).not.toMatch(/discount|promo code|% ?off/);
  });

  it('includes the market contact email', () => {
    const html = renderReviewRequestEmail({ order });
    expect(html).toContain('contact@example.com');
  });

  it('the ?rt= token verifies to the correct orderId + slug', () => {
    const html = renderReviewRequestEmail({ order });
    const match = html.match(/\?rt=([^"&#]+)#recenzii/);
    expect(match).not.toBeNull();
    const token = decodeURIComponent(match![1]);
    expect(verifyReviewToken(token)).toMatchObject({
      valid: true,
      orderId: order.orderId,
      slug: 'oslo-nightstand',
    });
  });

  it('escapes HTML in customer-supplied fields', () => {
    const evil: OrderDoc = {
      ...order,
      shipping: { ...order.shipping, firstName: '<script>alert(1)</script>' },
    };
    const html = renderReviewRequestEmail({ order: evil });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
