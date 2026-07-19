/**
 * Meta Conversions API server-side event sender.
 *
 * Invariants:
 *   - PII (email/phone/name/city/postcode) is SHA-256 hashed before send; raw values never leave this module.
 *   - `eventId` is the dedup key with the browser-side Pixel — for Purchase, it MUST equal the durable orderId.
 *   - Marketing-consent gate is enforced server-side too: `sendServerPurchase` drops the event when `marketingConsent !== true`.
 *   - Phone numbers are normalized to E.164 digits before hashing, keyed off the shipping country (RO: 0xxx → 40xxx, FR: 0xxx → 33xxx) — Meta cannot match the leading-zero form.
 * Side effects: outbound HTTPS to graph.facebook.com; failures go to the error sink (event metadata only, no PII); never throws.
 * Caller contract: pass the raw client IP / UA from `extractClientIp(headers)` and `headers.get('user-agent')` — never substitute synthetic values.
 */
import crypto from 'crypto'
import { clientEnv, serverEnv } from '@/env'
import { captureError } from '@/lib/error-sink'

const PIXEL_ID = clientEnv.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = serverEnv.META_CAPI_ACCESS_TOKEN
const TEST_EVENT_CODE = serverEnv.META_CAPI_TEST_EVENT_CODE
const API_VERSION = 'v21.0'

export const ALLOWED_META_EVENTS = [
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Lead',
  'Purchase',
] as const

export type MetaEventName = (typeof ALLOWED_META_EVENTS)[number]

export interface CapiUserData {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  city?: string
  country?: string
  postalCode?: string
  externalId?: string
  fbp?: string
  fbc?: string
  clientIp?: string
  clientUserAgent?: string
}

export interface CapiEventInput {
  eventName: MetaEventName
  eventId: string
  eventSourceUrl: string
  userData?: CapiUserData
  customData?: Record<string, unknown>
  /**
   * Per-call override for Meta's `test_event_code`. Forwarded from the browser
   * when an active Test Events session is detected, so prod traffic stays
   * untagged while testing sessions surface in the Test Events tab.
   */
  testEventCode?: string
}

export interface MetaBrowserTrackingData {
  fbp?: string
  fbc?: string
  externalId?: string
}

export interface CapiResult {
  ok: boolean
  status: number
  body: unknown
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function lower(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Resolve a free-text shipping country into the phone trunk-prefix region.
 *
 * The checkout form stores country as editable display text ("România",
 * "France") seeded from the market config's ISO code, so we match loosely:
 * any value containing "fr"/"france"/"français(e)" counts as FR. Unknown or
 * missing values default to RO — the pre-existing behavior for all RO orders.
 */
function resolvePhoneRegion(countryHint: string | undefined): 'RO' | 'FR' {
  if (!countryHint) return 'RO'
  const normalized = countryHint
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized === 'fr' || normalized.startsWith('fran')) return 'FR'
  return 'RO'
}

/**
 * Normalize a phone number to E.164 digits-only (no leading +), keyed off the
 * order's shipping country.
 *
 * Examples:
 *   "0712 345 678"            → "40712345678"   (RO default)
 *   "+40 712 345 678"         → "40712345678"
 *   "06 12 34 56 78" + France → "33612345678"
 *   "+33 6 12 34 56 78"       → "33612345678"   (any hint — already prefixed)
 *
 * A previous version always rewrote the national trunk 0 to Romania's 40 —
 * mangling French numbers into 40-prefixed garbage Meta could never match.
 * Already-prefixed 40/33 inputs are preserved regardless of the hint, so a
 * mismatched country can't corrupt an explicit international number.
 */
export function normalizePhoneE164(value: string, countryHint?: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  // Already internationally prefixed — trust the number over the hint.
  if (digits.startsWith('40')) return digits
  if (digits.startsWith('33')) return digits
  if (digits.startsWith('0') && digits.length === 10) {
    const prefix = resolvePhoneRegion(countryHint) === 'FR' ? '33' : '40'
    return `${prefix}${digits.slice(1)}`
  }
  return digits
}

function hashIfPresent(value: string | undefined, normalize: (s: string) => string): string | null {
  if (!value) return null
  const normalized = normalize(value)
  if (!normalized) return null
  return sha256Hex(normalized)
}

function buildUserData(input: CapiUserData | undefined): Record<string, unknown> {
  const userData: Record<string, unknown> = {}
  if (!input) return userData

  // Real client IP only — never send 127.0.0.1 or any synthetic fallback.
  if (input.clientIp) userData.client_ip_address = input.clientIp
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent
  if (input.fbp) userData.fbp = input.fbp
  if (input.fbc) userData.fbc = input.fbc

  const em = hashIfPresent(input.email, lower)
  if (em) userData.em = [em]

  // Phone trunk-prefix is country-dependent — key off the order's shipping
  // country so FR numbers get 33, not Romania's 40.
  const ph = hashIfPresent(input.phone, (v) => normalizePhoneE164(v, input.country))
  if (ph) userData.ph = [ph]

  const fn = hashIfPresent(input.firstName, lower)
  if (fn) userData.fn = [fn]

  const ln = hashIfPresent(input.lastName, lower)
  if (ln) userData.ln = [ln]

  const ct = hashIfPresent(input.city, lower)
  if (ct) userData.ct = [ct]

  const country = hashIfPresent(input.country, lower)
  if (country) userData.country = [country]

  const zp = hashIfPresent(input.postalCode, lower)
  if (zp) userData.zp = [zp]

  // External ID: opaque identifier, normalize lowercase but never assumed to be PII.
  const ext = hashIfPresent(input.externalId, lower)
  if (ext) userData.external_id = [ext]

  return userData
}

/**
 * Send a single event to Meta Conversions API.
 *
 * Returns ok=false on any failure (network, 4xx/5xx, missing config) but never
 * throws — callers can fire-and-forget without try/catch. All paths log.
 */
export async function sendCapiEvent(input: CapiEventInput): Promise<CapiResult> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn('[meta-capi] Pixel ID or access token missing — skipping event', input.eventName)
    return { ok: false, status: 0, body: { error: 'not_configured' } }
  }

  const userData = buildUserData(input.userData)
  const event = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    // Invariant: `event_id` is the dedup contract with the browser-side Pixel.
    // For Purchase, this MUST be the durable orderId so the server-side and
    // browser-side Purchase events collapse into one in Meta's pipeline.
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: 'website',
    user_data: userData,
    ...(input.customData ? { custom_data: input.customData } : {}),
  }

  const payload: Record<string, unknown> = {
    data: [event],
    access_token: ACCESS_TOKEN,
  }
  // Per-call override wins over env. Lets the client opt this single event
  // into Test Events without tagging the rest of prod traffic.
  const testCode = input.testEventCode || TEST_EVENT_CODE
  if (testCode) payload.test_event_code = testCode

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      // Error sink, not console — lost conversions must alert the operator.
      // Context is event metadata only: never the user_data payload (PII).
      captureError(
        new Error(`Meta CAPI Graph API error (HTTP ${response.status})`),
        { eventName: input.eventName, eventId: input.eventId, status: response.status, graphBody: body },
        { tag: 'meta_capi_graph_error' },
      )
      return { ok: false, status: response.status, body }
    }
    return { ok: true, status: response.status, body }
  } catch (err) {
    captureError(
      err,
      { eventName: input.eventName, eventId: input.eventId },
      { tag: 'meta_capi_fetch_failed' },
    )
    return { ok: false, status: 0, body: { error: 'fetch_failed' } }
  }
}

export function isServerPurchaseDisabled(): boolean {
  return serverEnv.META_CAPI_DISABLE_SERVER_PURCHASE === '1'
}

/**
 * Convenience: fire a server-side Purchase event with idempotent eventId.
 * Caller is responsible for own idempotency gating (e.g. webhook dedup).
 *
 * `eventId` MUST be the durable orderId so Pixel + CAPI dedupe across
 * sources. The browser fires Pixel Purchase with the same eventID.
 */
export async function sendServerPurchase(args: {
  orderId: string
  shipping: {
    email: string
    phone?: string
    firstName?: string
    lastName?: string
    city?: string
    country?: string
    postalCode?: string
  }
  clientIp?: string
  clientUserAgent?: string
  totalPrice: number
  /**
   * ISO currency of the order (e.g. 'RON', 'EUR'). REQUIRED — a silent
   * default here once sent hard-coded RON on EUR orders, corrupting Meta's
   * value optimization. Callers must pass the order's persisted currency
   * (or the market config currency for legacy docs).
   */
  currency: string
  contentIds: string[]
  numItems: number
  /**
   * Human-readable product name(s) — Meta's recommended `content_name`.
   * Pass the joined item names (e.g. "Acme Lounge Chair, Acme Arc Floor Lamp").
   */
  contentName?: string
  /** Shipping cost charged on the order — Meta's recommended `shipping`. */
  shippingCost?: number
  eventSourceUrl: string
  tracking?: MetaBrowserTrackingData
  customData?: Record<string, unknown>
  /**
   * GDPR gate: caller MUST pass the user's marketing-consent state. If
   * undefined or false, the event is not sent. Meta's Consent Mode v2
   * cohort modeling still benefits from declined users via Pixel-side
   * `fbq('consent','revoke')` — we don't need to leak PII server-side.
   */
  marketingConsent?: boolean
  /**
   * Per-call override for Meta's `test_event_code`. The browser captures
   * this from `?test_event_code=TEST…` into sessionStorage and forwards it
   * through the order body so the webhook + cod paths can tag the
   * server-side Purchase. Without this, CAPI Purchase silently lands in
   * the production stream and Test Events tab never surfaces it.
   */
  testEventCode?: string
}): Promise<CapiResult> {
  if (isServerPurchaseDisabled()) {
    console.warn('[meta-capi] server-side Purchase disabled via META_CAPI_DISABLE_SERVER_PURCHASE')
    return { ok: false, status: 0, body: { error: 'disabled' } }
  }
  // GDPR: server-side honors marketing consent too. Pixel-side `fbq('consent','revoke')`
  // is not sufficient on its own — without this gate, the webhook would still
  // leak hashed PII to Meta when a user has opted out.
  if (args.marketingConsent !== true) {
    return { ok: false, status: 0, body: { error: 'consent_denied_or_missing' } }
  }
  return sendCapiEvent({
    eventName: 'Purchase',
    eventId: args.orderId,
    eventSourceUrl: args.eventSourceUrl,
    testEventCode: args.testEventCode,
    userData: {
      email: args.shipping.email,
      phone: args.shipping.phone,
      firstName: args.shipping.firstName,
      lastName: args.shipping.lastName,
      city: args.shipping.city,
      country: args.shipping.country,
      postalCode: args.shipping.postalCode,
      externalId: args.tracking?.externalId,
      fbp: args.tracking?.fbp,
      fbc: args.tracking?.fbc,
      clientIp: args.clientIp,
      clientUserAgent: args.clientUserAgent,
    },
    customData: {
      value: args.totalPrice,
      currency: args.currency,
      content_ids: args.contentIds,
      content_type: 'product',
      num_items: args.numItems,
      ...(args.contentName ? { content_name: args.contentName } : {}),
      ...(typeof args.shippingCost === 'number' ? { shipping: args.shippingCost } : {}),
      // All orders are couriered to the customer's address — no pickup points.
      delivery_category: 'home_delivery',
      ...(args.customData ?? {}),
    },
  })
}

export function extractClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return undefined
}
