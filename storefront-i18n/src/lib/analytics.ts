'use client'

import { clientEnv } from '@/env'
import { hasMarketingConsent } from '@/lib/consent'
import { getStoredEmail } from '@/lib/email-capture'
import { isValidEmail, isValidRomanianPhone } from '@/lib/validation'
import {
  checkoutPaymentExperimentParams,
  resolveCheckoutPaymentVariantFromBrowser,
  type CheckoutPaymentVariant,
} from '@/lib/ab-testing'
import { categories, MARKETS, type ProductCategory } from '@/site.config'
import {
  DEFAULT_MARKET,
  getHostMarketMap,
  getMarketForLocale,
  type MarketKey,
} from '@/i18n/market-config'
import { getSearchableProducts } from '@/lib/product-search-index'
import type { LocaleKey } from '@/i18n/locales'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const EXTERNAL_ID_KEY = 'sf_ext_id'
const CHECKOUT_SHIPPING_DRAFT_KEY = 'storefront-checkout-shipping'
const META_TEST_EVENT_CODE_KEY = 'sf_meta_test_event_code'
const META_TEST_EVENT_CODE_PATTERN = /^TEST[A-Z0-9]{1,32}$/
// sessionStorage marker so InitiateCheckout fires once per cart signature
// across the sidebar path AND the checkout-page mount path.
const INITIATE_CHECKOUT_FIRED_KEY = 'sf_ic_fired'
// localStorage marker prefix so the browser Purchase pixel fires once per
// order across checkout success AND the confirmation page.
const PURCHASE_FIRED_PREFIX = 'sf_purchase_fired_'
let lastTrackedPageKey = ''

/**
 * Look up the active Meta Test Events code for the current tab.
 *
 * When a tester clicks into Events Manager → Test Events → "Test browser
 * events", FB opens the storefront with `?test_event_code=TEST12345`. We
 * pick that up once per tab and stash it in sessionStorage so subsequent
 * navigations within the test session keep tagging the CAPI events. Real
 * prod traffic never carries the param, so attribution stays clean.
 */
export function getMetaTestEventCode(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('test_event_code')?.trim().toUpperCase()
    if (fromUrl && META_TEST_EVENT_CODE_PATTERN.test(fromUrl)) {
      sessionStorage.setItem(META_TEST_EVENT_CODE_KEY, fromUrl)
      return fromUrl
    }
    const stored = sessionStorage.getItem(META_TEST_EVENT_CODE_KEY)?.trim().toUpperCase()
    if (stored && META_TEST_EVENT_CODE_PATTERN.test(stored)) return stored
    return undefined
  } catch {
    return undefined
  }
}

export interface MetaTrackingPayload {
  fbp?: string
  fbc?: string
  externalId?: string
}

function isValidMetaBrowserParam(value: string): boolean {
  return /^fb\.\d+\.\d{13}\.[^;\s]+(?:\.[A-Za-z0-9]{2,8})?$/.test(value)
}

/**
 * Generate a unique event ID for deduplication between Pixel and CAPI
 */
export function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

function getExternalId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(EXTERNAL_ID_KEY)
    if (!id) {
      id = `sf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      localStorage.setItem(EXTERNAL_ID_KEY, id)
    }
    return id
  } catch {
    return `sf_${Date.now()}`
  }
}

function getStoredCheckoutUserData(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CHECKOUT_SHIPPING_DRAFT_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    const data = parsed as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const key of ['phone', 'firstName', 'lastName', 'city', 'country', 'postalCode']) {
      const value = data[key]
      if (typeof value === 'string' && value.trim()) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function setCookie(name: string, value: string, days: number = 90) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`
}

export function getFbp(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)
  if (match && match[1]) return match[1]
  const fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 2147483647 + 1)}`
  setCookie('_fbp', fbp, 90)
  return fbp
}

export function getFbc(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)
  if (match && match[1]) return match[1]
  try {
    const url = new URL(window.location.href)
    const fbclid = url.searchParams.get('fbclid')
    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`
      setCookie('_fbc', fbc, 90)
      return fbc
    }
  } catch {
    // URL parsing failed
  }
  return ''
}

export function getMetaTrackingPayload(): MetaTrackingPayload {
  if (typeof window === 'undefined') return {}

  const fbp = getFbp()
  const fbc = getFbc()
  const externalId = getExternalId()

  return {
    ...(fbp && isValidMetaBrowserParam(fbp) ? { fbp } : {}),
    ...(fbc && isValidMetaBrowserParam(fbc) ? { fbc } : {}),
    ...(externalId ? { externalId } : {}),
  }
}

/**
 * Merge stored visitor PII (email + checkout draft fields) into the CAPI
 * user_data for conversion-adjacent events.
 *
 * Skipped on `PageView`: route changes recur with the same identifier across
 * a visitor's session, which Meta's Events Manager flags as duplicate-PII
 * (>50% rate) and downgrades match quality / attribution. PageView already
 * carries fbp/fbc/external_id + IP/UA — those are the right signals for it.
 *
 * Email and phone are validated before send. An invalid stored phone (e.g.
 * "5" left over from an abandoned form) is dropped rather than hashed and
 * sent — Meta explicitly recommends omitting the parameter over sending a
 * placeholder hash.
 */
function enrichUserDataForEvent(
  eventName: string,
  baseUserData?: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(baseUserData || {}) }
  if (eventName === 'PageView') return merged

  const storedEmail = getStoredEmail()
  if (storedEmail && isValidEmail(storedEmail) && !merged.email) {
    merged.email = storedEmail
  }
  const draft = getStoredCheckoutUserData()
  if (draft.phone && isValidRomanianPhone(draft.phone) && !merged.phone) {
    merged.phone = draft.phone
  }
  for (const key of ['firstName', 'lastName', 'city', 'country', 'postalCode'] as const) {
    if (draft[key] && !merged[key]) merged[key] = draft[key]
  }
  return merged
}

function sendServerEvent(
  eventName: string,
  eventId: string,
  customData?: Record<string, unknown>,
  userData?: Record<string, unknown>
) {
  if (typeof window === 'undefined') return

  try {
    const { fbp, fbc, externalId } = getMetaTrackingPayload()

    const mergedUserData = enrichUserDataForEvent(eventName, userData)

    const payload = JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      fbp: fbp || undefined,
      fbc: fbc || undefined,
      externalId: externalId || undefined,
      userAgent: navigator.userAgent,
      customData,
      userData: Object.keys(mergedUserData).length > 0 ? mergedUserData : undefined,
      testEventCode: getMetaTestEventCode(),
    })

    // Prefer navigator.sendBeacon — it queues the request without surfacing
    // in the browser's network/loading indicator. Switching from fetch
    // removes the brief progress-bar flash users see on add-to-cart, page
    // navigation, and any other tracked interaction.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' })
      const queued = navigator.sendBeacon('/api/meta-capi', blob)
      if (queued) return
    }

    // Fallback for environments without sendBeacon (older Safari, etc.).
    // keepalive: true lets the request finish even if the page unloads.
    fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch((err) => {
      console.error('CAPI event failed:', err)
    })
  } catch (err) {
    console.error('CAPI event failed:', err)
  }
}

/**
 * Track a Meta event — fires both Pixel (client) and CAPI (server).
 *
 * Consent-gated: when the user hasn't granted marketing consent, both the
 * Pixel call and the CAPI relay are skipped. Meta Consent Mode v2 already
 * received `fbq('consent', 'revoke')` from MetaPixel.tsx, so Meta uses
 * cohort-modeled conversions for declined users instead of any event from
 * us. This is the GDPR-compliant version of "still send signal".
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
  userData?: Record<string, unknown>
) {
  if (!hasMarketingConsent()) return

  const eventId = generateEventId()
  const pixelParams = params && Object.keys(params).length > 0 ? params : undefined

  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, pixelParams, { eventID: eventId })
  }

  sendServerEvent(eventName, eventId, params, userData)
}

/**
 * GA4 line item as supplied by call sites. `id` is the cart/catalog content
 * id (`<category>__<slug>`, e.g. `furniture__aria-console`) — the SAME id
 * the Meta events use — and is converted to the Google Merchant Center
 * offerId (`<category>_<slug>`, e.g. `furniture_aria-console`) at send time.
 */
export interface Ga4LineItem {
  id: string
  name?: string
  price?: number
  quantity?: number
}

/**
 * Map a cart/catalog content id (`furniture__aria-console`) to the Google
 * Merchant Center offerId (`furniture_aria-console`).
 *
 * Invariant: must stay equal to the `g:id` emitted by
 * `src/lib/google-merchant.ts` (`${product.category}_${product.slug}`) so
 * GA4 items join up with the Shopping feed. The category key comes from the
 * same `categories` registry the feed derives from. Unknown ids pass through
 * unchanged — better a recognizable raw id than a dropped item.
 */
export function contentIdToGa4ItemId(contentId: string): string {
  const sep = contentId.indexOf('__')
  if (sep > 0) {
    const categoryKey = contentId.slice(0, sep)
    const slug = contentId.slice(sep + 2)
    const category = categories.find((c) => c.key === categoryKey)
    if (category && slug) return `${category.key}_${slug}`
  }
  return contentId
}

/**
 * Market for GA4 event params. Call sites that know their market pass it
 * explicitly; otherwise resolve from the browser — production domains map
 * 1:1 to markets (host map), dev/preview hosts use the locale path prefix
 * (`/ro/...`), and everything else falls back to the default market.
 */
function resolveGa4Market(explicit?: MarketKey): MarketKey {
  if (explicit) return explicit
  if (typeof window === 'undefined') return DEFAULT_MARKET
  try {
    const byHost = getHostMarketMap()[window.location.hostname.toLowerCase()]
    if (byHost) return byHost
    const firstSegment = window.location.pathname.split('/')[1]
    for (const m of Object.values(MARKETS)) {
      if (m.locale === firstSegment) return m.key
    }
  } catch {
    // location unavailable — fall through to the default market.
  }
  return DEFAULT_MARKET
}

/**
 * Shared GA4 event params: per-market `currency` (RON on RO, EUR on english)
 * plus the `market` / `country` dimensions the single-property multidomain
 * setup splits reports by (see MARKETS[*].analytics in site.config.ts).
 */
function ga4MarketParams(market: MarketKey, explicitCurrency?: string): Record<string, unknown> {
  const config = MARKETS[market]
  return {
    currency: explicitCurrency || config.currency,
    market,
    country: config.shipping.defaultCountryCode,
  }
}

function toGa4Items(
  items: Ga4LineItem[] | undefined,
  fallbackContentIds: string[] | undefined,
): Array<Record<string, unknown>> {
  if (items && items.length > 0) {
    return items.map((item) => ({
      item_id: contentIdToGa4ItemId(item.id),
      ...(item.name ? { item_name: item.name } : {}),
      ...(typeof item.price === 'number' ? { price: item.price } : {}),
      quantity: item.quantity ?? 1,
    }))
  }
  return (fallbackContentIds ?? []).map((id) => ({
    item_id: contentIdToGa4ItemId(id),
    quantity: 1,
  }))
}

/**
 * Single GA4 transport — every GA4 send in the app goes through here so the
 * mechanism stays swappable (gtag direct today, GTM dataLayer tags if the
 * container ever takes over).
 *
 * Transport: `gtag('event', …)` against the measurement id loaded directly
 * in `[locale]/layout.tsx`. Chosen over raw dataLayer ecommerce pushes
 * because those only become GA4 events if the external GTM container grows
 * per-event GA4 tags — config that does not live in this repo. When gtag.js
 * hasn't loaded yet (it's `lazyOnload`), the standard command-queue stub is
 * installed so early events are replayed by the library once it arrives.
 *
 * Consent-gated like the Meta path: no marketing consent → nothing is sent
 * or queued (Consent Mode v2 defaults are pinned by the layout bootstrap).
 */
export function sendGa4Event(eventName: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (!hasMarketingConsent()) return
  try {
    window.dataLayer = window.dataLayer || []
    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        // gtag.js replays `arguments` objects from the dataLayer — a plain
        // array push would be ignored, so this must stay a `function`.
        // eslint-disable-next-line prefer-rest-params
        ;(window.dataLayer as unknown[]).push(arguments)
      }
    }
    window.gtag('event', eventName, params)
  } catch {
    // Tracking must never break the storefront.
  }
}

export function trackPageView(pageKey?: string) {
  if (typeof window === 'undefined') return
  // Consent gate BEFORE the dedup key is burned: a consent-blocked attempt
  // must leave the key untouched so the consent-grant listener in
  // MetaPixel.tsx can re-call with the same key and actually fire the
  // deferred post-consent PageView (otherwise the landing page's PageView —
  // Pixel AND CAPI — is lost for every visitor who accepts the banner).
  if (!hasMarketingConsent()) return

  const resolvedPageKey =
    pageKey ||
    `${window.location.pathname}${window.location.search}${window.location.hash}`

  if (resolvedPageKey === lastTrackedPageKey) return

  lastTrackedPageKey = resolvedPageKey
  trackEvent('PageView')
}

export interface ViewContentOptions {
  /** Catalog ids matching AddToCart/InitiateCheckout/Purchase (`furniture__aria-console`). */
  contentIds?: string[]
  /** Market currency — derived from the market serving the locale. */
  currency?: string
  /** Commercial market — resolved from the browser host/path when omitted. */
  market?: MarketKey
}

export function trackViewContent(
  contentName: string,
  contentCategory: string,
  value?: number,
  options?: ViewContentOptions,
) {
  trackEvent('ViewContent', {
    content_name: contentName,
    content_category: contentCategory,
    content_type: 'product',
    ...(options?.contentIds?.length ? { content_ids: options.contentIds } : {}),
    ...(value ? { value, currency: options?.currency || 'RON' } : {}),
  })

  // GA4 mirror — view_item with the Merchant Center offerId as item_id.
  const market = resolveGa4Market(options?.market)
  sendGa4Event('view_item', {
    ...ga4MarketParams(market, options?.currency),
    ...(value ? { value } : {}),
    items: options?.contentIds?.length
      ? options.contentIds.map((id) => ({
          item_id: contentIdToGa4ItemId(id),
          item_name: contentName,
          ...(value ? { price: value } : {}),
          quantity: 1,
        }))
      : [{ item_name: contentName, ...(value ? { price: value } : {}), quantity: 1 }],
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve a product detail page from the next-intl pathname.
 *
 * `usePathname()` from `@/i18n/navigation` returns the INTERNAL pathname;
 * with localized `pathnames` configured, dynamic routes come back as the
 * route template (`/furniture/[slug]`) regardless of locale — the concrete
 * slug lives in the route params. Defensively this also accepts concrete
 * paths, both internal (`/furniture/aria-console`) and localized
 * (`/mobilier/aria-console`), so the event keeps firing if the navigation
 * wrapper's behavior changes.
 */
export function resolveProductPath(
  pathname: string,
  slugParam: string | undefined,
): { category: ProductCategory; slug: string } | null {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  for (const cat of categories) {
    // Candidate listing bases: the canonical key plus every localized path.
    const bases = new Set<string>([`/${cat.key}`, ...Object.values(cat.pathnames)])
    for (const base of bases) {
      if (normalized === `${base}/[slug]`) {
        return slugParam ? { category: cat.key, slug: slugParam } : null
      }
      const match = normalized.match(new RegExp(`^${escapeRegExp(base)}/([^/]+)$`))
      if (match && match[1] !== '[slug]') {
        return { category: cat.key, slug: decodeURIComponent(match[1]) }
      }
    }
  }
  return null
}

/**
 * Fire ViewContent for the product page at `pathname` (any category, any
 * locale). content_ids uses the catalog id (`<category>__<slug>`, e.g.
 * `furniture__aria-console`) so DPA retargeting joins up with AddToCart /
 * InitiateCheckout / Purchase; value + currency come from the market that
 * serves the locale. No-op when the pathname is not a product page or the
 * product has no content for the locale.
 */
export function trackProductView(options: {
  pathname: string
  slug?: string
  locale: LocaleKey
}) {
  const resolved = resolveProductPath(options.pathname, options.slug)
  if (!resolved) return

  const market = getMarketForLocale(options.locale)
  const product = getSearchableProducts(options.locale, market).find(
    (p) => p.category === resolved.category && p.slug === resolved.slug,
  )
  if (!product) return

  const categoryConfig = categories.find((c) => c.key === product.category)
  const contentId = `${product.category}__${product.slug}`
  trackViewContent(
    product.shortName,
    categoryConfig?.labels[options.locale] ?? product.category,
    product.price,
    { contentIds: [contentId], currency: MARKETS[market].currency, market },
  )
}

export interface AddToCartOptions {
  /** Cart/catalog content id (`furniture__aria-console`) — feeds the GA4 item_id. */
  contentId?: string
  /** Market currency for BOTH the Meta payload and the GA4 event. */
  currency?: string
  /** Commercial market — resolved from the browser host/path when omitted. */
  market?: MarketKey
}

export function trackAddToCart(
  productName: string,
  quantity: string,
  value?: number,
  userData?: Record<string, unknown>,
  options?: AddToCartOptions,
) {
  trackEvent('AddToCart', {
    content_name: productName,
    content_type: 'product',
    quantity,
    // Market currency: call sites pass the per-market price as `value`, so a
    // hardcoded RON here mislabeled EUR amounts on the EUR market.
    ...(value ? { value, currency: options?.currency || 'RON' } : {}),
  }, userData)

  // GA4 mirror — `value` is the line total (unit price × quantity).
  const market = resolveGa4Market(options?.market)
  const qty = Math.max(1, Number.parseInt(quantity, 10) || 1)
  sendGa4Event('add_to_cart', {
    ...ga4MarketParams(market, options?.currency),
    ...(value ? { value } : {}),
    items: [
      {
        ...(options?.contentId ? { item_id: contentIdToGa4ItemId(options.contentId) } : {}),
        item_name: productName,
        ...(value ? { price: value / qty } : {}),
        quantity: qty,
      },
    ],
  })
}

export function trackInitiateCheckout(productName?: string) {
  trackEvent(
    'InitiateCheckout',
    {
      content_name: productName || 'General Inquiry',
      content_type: 'product',
    }
  )
}

export interface CartCheckoutTrackingOptions {
  contentIds: string[]
  numItems: number
  value: number
  currency?: string
  checkoutPaymentUi?: CheckoutPaymentVariant
  /** Per-line items for the GA4 mirror — falls back to contentIds ×1. */
  items?: Ga4LineItem[]
  /** Commercial market — resolved from the browser host/path when omitted. */
  market?: MarketKey
}

export function trackCartInitiateCheckout(options: CartCheckoutTrackingOptions) {
  const checkoutPaymentUi = options.checkoutPaymentUi ?? resolveCheckoutPaymentVariantFromBrowser()
  trackEvent('InitiateCheckout', {
    content_ids: options.contentIds,
    content_type: 'product',
    num_items: options.numItems,
    value: options.value,
    currency: options.currency || 'RON',
    ...checkoutPaymentExperimentParams(checkoutPaymentUi),
  })

  // GA4 mirror.
  const market = resolveGa4Market(options.market)
  sendGa4Event('begin_checkout', {
    ...ga4MarketParams(market, options.currency),
    value: options.value,
    items: toGa4Items(options.items, options.contentIds),
  })
}

/**
 * Cart signature for the InitiateCheckout once-guard. Deliberately excludes
 * the monetary value: coupon application can shift the displayed total
 * between the sidebar click and the checkout mount, and a value-keyed
 * signature would double-fire on that jitter. Ids + item count identify the
 * cart well enough for "did we already announce this checkout intent".
 */
function initiateCheckoutSignature(contentIds: string[], numItems: number): string {
  return `${[...contentIds].sort().join(',')}|${numItems}`
}

/**
 * Fire InitiateCheckout at most once per cart signature per session.
 *
 * Two call sites share the guard: CartSidebar's checkout button (fires
 * before routing) and the checkout page mount (covers direct navigations —
 * recovery links, bookmarks, FloatingCartBar paths). The sidebar path marks
 * the signature, so the subsequent checkout mount is a no-op; a direct
 * visit finds no marker and fires.
 *
 * Consent: checked here (not only inside trackEvent) so a declined visitor
 * doesn't burn the marker — if they grant consent later in the session, the
 * next checkout entry still emits the event.
 */
export function trackCartInitiateCheckoutOnce(options: CartCheckoutTrackingOptions) {
  if (typeof window === 'undefined') return
  if (options.contentIds.length === 0 || options.numItems <= 0) return
  if (!hasMarketingConsent()) return

  const signature = initiateCheckoutSignature(options.contentIds, options.numItems)
  try {
    if (sessionStorage.getItem(INITIATE_CHECKOUT_FIRED_KEY) === signature) return
  } catch {
    // sessionStorage unavailable — fall through and fire unguarded.
  }

  trackCartInitiateCheckout(options)

  try {
    sessionStorage.setItem(INITIATE_CHECKOUT_FIRED_KEY, signature)
  } catch {
    // Storage write failed — worst case the event fires again.
  }
}

export function trackAddPaymentInfo(options: CartCheckoutTrackingOptions & {
  paymentMethod: string
}) {
  const checkoutPaymentUi = options.checkoutPaymentUi ?? resolveCheckoutPaymentVariantFromBrowser()
  trackEvent('AddPaymentInfo', {
    content_ids: options.contentIds,
    content_type: 'product',
    num_items: options.numItems,
    value: options.value,
    currency: options.currency || 'RON',
    payment_method: options.paymentMethod,
    ...checkoutPaymentExperimentParams(checkoutPaymentUi),
  })

  // GA4 mirror — `payment_type` is the standard GA4 param name.
  const market = resolveGa4Market(options.market)
  sendGa4Event('add_payment_info', {
    ...ga4MarketParams(market, options.currency),
    value: options.value,
    payment_type: options.paymentMethod,
    items: toGa4Items(options.items, options.contentIds),
  })
}

/**
 * Re-init the Pixel with `em` advanced matching once we have the user's
 * email (e.g. at /checkout step 1). Pixel auto-hashes `em` and includes it
 * in user_data on every subsequent `fbq('track', …)` call until the page
 * unloads — so all downstream events (PageView on /checkout, AddPaymentInfo
 * if added, etc.) carry a hashed email. Past events are NOT re-enriched; for
 * those, the existing `getStoredEmail()` merge in `sendServerEvent` already
 * adds `em` to the CAPI mirror's user_data.
 */
export function enrichPixelWithEmail(email: string) {
  if (typeof window === 'undefined' || !window.fbq) return
  if (!hasMarketingConsent()) return
  const pixelId = clientEnv.NEXT_PUBLIC_META_PIXEL_ID
  if (!pixelId) return
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return
  let externalId: string | undefined
  try {
    externalId = localStorage.getItem(EXTERNAL_ID_KEY) || undefined
  } catch {
    // localStorage disabled — proceed without external_id
  }
  window.fbq('init', pixelId, {
    em: trimmed,
    ...(externalId ? { external_id: externalId } : {}),
  })
}

export interface PurchaseTrackingOptions {
  orderId: string
  contentIds: string[]
  numItems: number
  value: number
  currency?: string
  checkoutPaymentUi?: CheckoutPaymentVariant
  /** Shipping cost when the call site knows it — GA4 `shipping` param. */
  shipping?: number
  /** Per-line items for the GA4 mirror — falls back to contentIds ×1. */
  items?: Ga4LineItem[]
  /** Commercial market — resolved from the browser host/path when omitted. */
  market?: MarketKey
}

/**
 * Fire the browser Purchase: Meta Pixel (deterministic eventID = orderId)
 * plus the GA4 `purchase` mirror (transaction_id = the SAME orderId, so the
 * two platforms reconcile per order). The Meta CAPI side is fired from the
 * server (post-save in /api/order, post-payment in the Revolut webhook)
 * using the same orderId, so Meta deduplicates browser and server events
 * automatically.
 *
 * Don't call sendServerEvent here — duplicating the CAPI side from the
 * browser would race the server-side fire and risks sending PII without
 * proper hashing context.
 *
 * Returns true when consent allowed the send. The GA4 transport queues into
 * the gtag command queue even before gtag.js loads, so a missing/blocked
 * `window.fbq` no longer suppresses the whole event — Meta's signal is then
 * covered by the server CAPI Purchase (same orderId).
 */
export function trackPurchase(options: PurchaseTrackingOptions): boolean {
  if (typeof window === 'undefined') return false
  if (!hasMarketingConsent()) return false
  const checkoutPaymentUi = options.checkoutPaymentUi ?? resolveCheckoutPaymentVariantFromBrowser()
  if (window.fbq) {
    // Parity with the server CAPI Purchase custom_data (lib/meta-capi.ts):
    // Meta dedupes the browser/server pair by event_id (= orderId), so the
    // surviving event must not lose content_name / shipping /
    // delivery_category depending on which side won.
    const contentName = options.items
      ?.map((item) => item.name)
      .filter(Boolean)
      .join(', ')
    window.fbq(
      'track',
      'Purchase',
      {
        content_ids: options.contentIds,
        content_type: 'product',
        num_items: options.numItems,
        value: options.value,
        currency: options.currency || 'RON',
        ...(contentName ? { content_name: contentName } : {}),
        ...(typeof options.shipping === 'number' ? { shipping: options.shipping } : {}),
        delivery_category: 'home_delivery',
        ...checkoutPaymentExperimentParams(checkoutPaymentUi),
      },
      { eventID: options.orderId }
    )
  }

  // GA4 mirror. transaction_id doubles as the dedup key when GA4
  // collapses duplicate purchases; the localStorage once-marker (see
  // trackPurchaseOnce) keeps refreshes from re-sending at all.
  const market = resolveGa4Market(options.market)
  sendGa4Event('purchase', {
    transaction_id: options.orderId,
    ...ga4MarketParams(market, options.currency),
    value: options.value,
    ...(typeof options.shipping === 'number' ? { shipping: options.shipping } : {}),
    items: toGa4Items(options.items, options.contentIds),
  })
  return true
}

export function hasTrackedPurchase(orderId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(PURCHASE_FIRED_PREFIX + orderId) === '1'
  } catch {
    return false
  }
}

export function markPurchaseTracked(orderId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PURCHASE_FIRED_PREFIX + orderId, '1')
  } catch {
    // Storage unavailable — Meta's event_id dedup still protects us.
  }
}

/**
 * Fire the browser Purchase (Meta Pixel + GA4 mirror) at most once per
 * orderId across the checkout success path and the confirmation page (which
 * covers the mobile wallet return path, where checkout's
 * handlePaymentSuccess never runs).
 *
 * Meta and GA4 share this marker so they fire (or skip) together. For Meta
 * the marker is hygiene, not correctness — event_id (= orderId) dedup drops
 * duplicates server-side anyway. For GA4 it IS the refresh guard: nothing
 * deduplicates client-side resends reliably, so a confirmation-page reload
 * must not emit a second `purchase`. The marker is only written when the
 * send actually happened (consent granted), so a declined session doesn't
 * lose the event forever if the user consents later.
 */
export function trackPurchaseOnce(options: PurchaseTrackingOptions): void {
  if (hasTrackedPurchase(options.orderId)) return
  if (trackPurchase(options)) {
    markPurchaseTracked(options.orderId)
  }
}
