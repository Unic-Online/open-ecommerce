import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECKOUT_SHIPPING_DRAFT_KEY,
  clearCheckoutShippingDraft,
  persistCheckoutShippingDraft,
  readCheckoutShippingDraft,
} from '@/lib/checkout-shipping-draft'

describe('checkout shipping localStorage draft', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('persists meaningful customer fields from an incomplete checkout form', () => {
    persistCheckoutShippingDraft({
      firstName: ' Ana ',
      lastName: '',
      email: 'ana@',
      phone: '07',
      country: ' România ',
      altCountry: ' România ',
      billingType: 'individual',
      useAltShipping: false,
    })

    expect(readCheckoutShippingDraft()).toEqual({
      firstName: 'Ana',
      email: 'ana@',
      phone: '07',
      country: 'România',
      altCountry: 'România',
      billingType: 'individual',
      useAltShipping: false,
    })
  })

  it('merges partial updates and removes fields explicitly cleared by the form', () => {
    persistCheckoutShippingDraft({
      firstName: 'Ana',
      phone: '+40740000000',
      city: 'Cluj-Napoca',
    })

    persistCheckoutShippingDraft({
      phone: '',
      county: 'Cluj',
    })

    expect(readCheckoutShippingDraft()).toEqual({
      firstName: 'Ana',
      city: 'Cluj-Napoca',
      county: 'Cluj',
    })
  })

  it('ignores malformed storage, unknown fields, and wrong field types', () => {
    localStorage.setItem(
      CHECKOUT_SHIPPING_DRAFT_KEY,
      JSON.stringify({
        firstName: 123,
        email: ' buyer@test.ro ',
        billingType: 'not-a-real-type',
        useAltShipping: 'yes',
        unknownField: 'ignored',
      }),
    )

    expect(readCheckoutShippingDraft()).toEqual({
      email: 'buyer@test.ro',
    })

    localStorage.setItem(CHECKOUT_SHIPPING_DRAFT_KEY, '{not json')
    expect(readCheckoutShippingDraft()).toEqual({})
  })

  it('does not keep storage alive for default-only checkout state', () => {
    persistCheckoutShippingDraft({
      country: 'România',
      altCountry: 'România',
      billingType: 'individual',
      useAltShipping: false,
    })

    expect(localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)).toBeNull()
  })

  it('removes the storage key when all meaningful customer fields are cleared', () => {
    persistCheckoutShippingDraft({
      firstName: 'Ana',
      phone: '+40740000000',
      country: 'România',
    })

    persistCheckoutShippingDraft({
      firstName: '',
      phone: '',
      country: 'România',
      altCountry: 'România',
      billingType: 'individual',
      useAltShipping: false,
    })

    expect(localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)).toBeNull()
  })

  it('can still be cleared explicitly for manual reset flows', () => {
    persistCheckoutShippingDraft({
      firstName: 'Ana',
    })

    clearCheckoutShippingDraft()

    expect(localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)).toBeNull()
  })
})
