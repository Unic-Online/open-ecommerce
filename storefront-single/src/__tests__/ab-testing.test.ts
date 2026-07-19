import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_PAYMENT_EXPERIMENT_COOKIE,
  normalizeCheckoutPaymentVariant,
  readCheckoutPaymentVariantCookie,
  resolveCheckoutPaymentVariantFromUrl,
} from '@/lib/ab-testing'

describe('A/B testing helpers', () => {
  it('normalizes checkout payment UI aliases', () => {
    expect(normalizeCheckoutPaymentVariant('control')).toBe('control')
    expect(normalizeCheckoutPaymentVariant('a')).toBe('control')
    expect(normalizeCheckoutPaymentVariant('compact')).toBe('compact_payment_options')
    expect(normalizeCheckoutPaymentVariant('b')).toBe('compact_payment_options')
    expect(normalizeCheckoutPaymentVariant('unknown')).toBeNull()
  })

  it('reads checkout payment UI from URL and cookie values', () => {
    expect(resolveCheckoutPaymentVariantFromUrl('https://ro.shop.example.com/checkout?checkout_payment_ui=compact'))
      .toBe('compact_payment_options')
    expect(
      readCheckoutPaymentVariantCookie(`${CHECKOUT_PAYMENT_EXPERIMENT_COOKIE}=control; other=1`),
    ).toBe('control')
  })
})
