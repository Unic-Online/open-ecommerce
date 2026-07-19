import type { ShippingData } from './validation'

export const CHECKOUT_SHIPPING_DRAFT_KEY = 'storefront-checkout-shipping'

export type CheckoutShippingDraft = Partial<ShippingData>

const STRING_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'county',
  'city',
  'address',
  'country',
  'postalCode',
  'companyName',
  'companyCui',
  'companyRegCom',
  'altAddress',
  'altCity',
  'altCounty',
  'altPostalCode',
  'altCountry',
] as const satisfies ReadonlyArray<keyof CheckoutShippingDraft>

type StringField = (typeof STRING_FIELDS)[number]

const DEFAULT_ONLY_STRING_FIELDS = new Set<StringField>(['country', 'altCountry'])
const MAX_FIELD_LENGTH = 256

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_FIELD_LENGTH)
}

function sanitizeStoredDraft(value: unknown): CheckoutShippingDraft {
  if (!isRecord(value)) return {}

  const out: CheckoutShippingDraft = {}
  for (const field of STRING_FIELDS) {
    const normalized = normalizeString(value[field])
    if (normalized) {
      out[field] = normalized
    }
  }

  if (value.billingType === 'individual' || value.billingType === 'company') {
    out.billingType = value.billingType
  }

  if (typeof value.useAltShipping === 'boolean') {
    out.useAltShipping = value.useAltShipping
  }

  return out
}

function hasMeaningfulCustomerValue(draft: CheckoutShippingDraft): boolean {
  for (const field of STRING_FIELDS) {
    if (DEFAULT_ONLY_STRING_FIELDS.has(field)) continue
    const value = draft[field]
    if (typeof value === 'string' && value.trim()) return true
  }

  return draft.billingType === 'company' || draft.useAltShipping === true
}

export function readCheckoutShippingDraft(): CheckoutShippingDraft {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)
    return sanitizeStoredDraft(parsed)
  } catch {
    return {}
  }
}

export function persistCheckoutShippingDraft(draft: CheckoutShippingDraft): void {
  if (typeof window === 'undefined') return

  const incoming = isRecord(draft) ? draft : {}
  const next: CheckoutShippingDraft = readCheckoutShippingDraft()

  for (const field of STRING_FIELDS) {
    if (!hasOwn(incoming, field)) continue
    const normalized = normalizeString(incoming[field])
    if (normalized) {
      next[field] = normalized
    } else {
      delete next[field]
    }
  }

  if (hasOwn(incoming, 'billingType')) {
    if (incoming.billingType === 'individual' || incoming.billingType === 'company') {
      next.billingType = incoming.billingType
    } else {
      delete next.billingType
    }
  }

  if (hasOwn(incoming, 'useAltShipping')) {
    if (typeof incoming.useAltShipping === 'boolean') {
      next.useAltShipping = incoming.useAltShipping
    } else {
      delete next.useAltShipping
    }
  }

  try {
    if (!hasMeaningfulCustomerValue(next)) {
      localStorage.removeItem(CHECKOUT_SHIPPING_DRAFT_KEY)
      return
    }
    localStorage.setItem(CHECKOUT_SHIPPING_DRAFT_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable
  }
}

export function clearCheckoutShippingDraft(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(CHECKOUT_SHIPPING_DRAFT_KEY)
  } catch {
    // Storage unavailable
  }
}
