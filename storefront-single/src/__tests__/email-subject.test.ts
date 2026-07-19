/**
 * Customer email subjects on this English-only template must be English on
 * EVERY send path. Regression: the Revolut webhook shipped with hardcoded
 * Romanian subjects (`Comandă plătită #X` / `Mulțumim pentru comandă — #X`)
 * left over from the upstream RO storefront. The webhook route itself is
 * pinned in revolut-webhook-route.test.ts; this covers the shared helper.
 */
import { describe, it, expect } from 'vitest';
import { customerOrderEmailSubject } from '@/lib/emails/customer-order-email';

describe('customerOrderEmailSubject', () => {
  it('emits English subjects for every send path', () => {
    expect(customerOrderEmailSubject('placed', 'AB12CD34')).toBe('Your order — #AB12CD34');
    expect(customerOrderEmailSubject('paid', 'AB12CD34')).toBe('Thank you for your order — #AB12CD34');
    expect(customerOrderEmailSubject('resend', 'AB12CD34')).toBe('Order confirmation #AB12CD34');
  });
});
