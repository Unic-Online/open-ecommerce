export const CHECKOUT_PAYMENT_EXPERIMENT_NAME = 'checkout_payment_ui'
export const CHECKOUT_PAYMENT_EXPERIMENT_COOKIE = 'sf_ab_checkout_payment_ui'
export const CHECKOUT_PAYMENT_EXPERIMENT_QUERY_PARAM = 'checkout_payment_ui'
export const CHECKOUT_PAYMENT_EXPERIMENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const CHECKOUT_PAYMENT_VARIANTS = ['control', 'compact_payment_options'] as const

export type CheckoutPaymentVariant = (typeof CHECKOUT_PAYMENT_VARIANTS)[number]

export interface CheckoutExperimentAssignment {
  checkoutPaymentUi: CheckoutPaymentVariant
}

const QUERY_ALIASES: Record<string, CheckoutPaymentVariant> = {
  a: 'control',
  control: 'control',
  default: 'control',
  b: 'compact_payment_options',
  compact: 'compact_payment_options',
  compact_payment_options: 'compact_payment_options',
}

function isCheckoutPaymentVariant(value: string): value is CheckoutPaymentVariant {
  return CHECKOUT_PAYMENT_VARIANTS.includes(value as CheckoutPaymentVariant)
}

export function normalizeCheckoutPaymentVariant(
  value: string | null | undefined,
): CheckoutPaymentVariant | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (isCheckoutPaymentVariant(normalized)) return normalized
  return QUERY_ALIASES[normalized] ?? null
}

export function checkoutPaymentExperimentParams(
  variant: CheckoutPaymentVariant,
): Record<string, string> {
  return {
    experiment_name: CHECKOUT_PAYMENT_EXPERIMENT_NAME,
    experiment_variant: variant,
    checkout_payment_ui: variant,
  }
}

export function readCheckoutPaymentVariantCookie(
  cookieHeader: string | null | undefined,
): CheckoutPaymentVariant | null {
  if (!cookieHeader) return null
  const escaped = CHECKOUT_PAYMENT_EXPERIMENT_COOKIE.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`))
  return normalizeCheckoutPaymentVariant(match ? decodeURIComponent(match[1]) : null)
}

export function readCheckoutPaymentVariantFromDocument(): CheckoutPaymentVariant | null {
  if (typeof document === 'undefined') return null
  return readCheckoutPaymentVariantCookie(document.cookie)
}

export function writeCheckoutPaymentVariantCookie(variant: CheckoutPaymentVariant) {
  if (typeof document === 'undefined') return
  const parts = [
    `${CHECKOUT_PAYMENT_EXPERIMENT_COOKIE}=${encodeURIComponent(variant)}`,
    `Max-Age=${CHECKOUT_PAYMENT_EXPERIMENT_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ]
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    parts.push('Secure')
  }
  document.cookie = parts.join(';')
}

export function resolveCheckoutPaymentVariantFromUrl(url: string): CheckoutPaymentVariant | null {
  try {
    const parsed = new URL(url)
    return normalizeCheckoutPaymentVariant(
      parsed.searchParams.get(CHECKOUT_PAYMENT_EXPERIMENT_QUERY_PARAM),
    )
  } catch {
    return null
  }
}

export function resolveCheckoutPaymentVariantFromBrowser(): CheckoutPaymentVariant {
  if (typeof window === 'undefined') return 'control'

  const urlVariant = resolveCheckoutPaymentVariantFromUrl(window.location.href)
  if (urlVariant) {
    writeCheckoutPaymentVariantCookie(urlVariant)
    return urlVariant
  }

  return readCheckoutPaymentVariantFromDocument() ?? 'control'
}

export function getCheckoutExperimentAssignment(
  variant: CheckoutPaymentVariant,
): CheckoutExperimentAssignment {
  return { checkoutPaymentUi: variant }
}
