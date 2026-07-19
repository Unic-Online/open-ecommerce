/**
 * Single source of truth for input validation — same Zod schemas run on the client form and the server route.
 *
 * Invariants:
 *   - One regex/rule per field; do not duplicate email/phone validation elsewhere (see AGENTS.md).
 *   - Default error messages are in Romanian (legacy callers/server). Locale-aware factories
 *     accept a `t` function to emit localized errors at form-render time.
 *   - Server-only fields (`marketingConsent`, `couponCode`) default-deny when omitted.
 * Side effects: none.
 * Caller contract: routes MUST `safeParse` the raw body and return 400 on failure — never trust shape from the wire.
 */
import { z } from 'zod'

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidRomanianPhone(phone: string): boolean {
  // Lenient digits-only ≥10 check; meta-capi.normalizePhoneE164 handles 0/+40/40 prefixes downstream.
  return phone.replace(/\D/g, '').length >= 10
}

// Translation function shape compatible with the `useTranslations('validation')`
// shim. Keeping the shape narrow lets the schema accept either a real `t` or a
// thin fallback that maps keys back to the default English messages.
export type ValidationTranslator = (key: string) => string

export const VALIDATION_KEYS = {
  firstName: 'firstNameRequired',
  lastName: 'lastNameRequired',
  email: 'emailInvalid',
  phone: 'phoneInvalid',
  county: 'countyRequired',
  city: 'cityRequired',
  address: 'addressRequired',
  country: 'countryRequired',
  postalCode: 'postalCodeRequired',
  companyName: 'companyNameRequired',
  companyCui: 'companyCuiRequired',
  companyRegCom: 'companyRegComRequired',
  altAddress: 'altAddressRequired',
  altCity: 'cityRequired',
  altCounty: 'countyRequired',
  altPostalCode: 'postalCodeRequired',
  altCountry: 'countryRequired',
  coupon: 'couponInvalid',
  orderItems: 'orderItemsRequired',
} as const

// Default English messages — used by server route handlers and any caller that
// doesn't pass a translator. Mirrors `src/content/strings.ts` (validation ns).
const DEFAULTS: Record<string, string> = {
  firstNameRequired: 'First name is required',
  lastNameRequired: 'Last name is required',
  emailInvalid: 'Invalid email address',
  phoneInvalid: 'Invalid phone number',
  countyRequired: 'County is required',
  cityRequired: 'City is required',
  addressRequired: 'Address is required',
  countryRequired: 'Country is required',
  postalCodeRequired: 'Postcode is required',
  companyNameRequired: 'Company name is required',
  companyCuiRequired: 'Company registration number is required',
  companyRegComRequired: 'Companies House number is required',
  altAddressRequired: 'Delivery address is required',
  couponInvalid: 'Invalid discount code',
  orderItemsRequired: 'Your order must contain at least one item',
}

const defaultT: ValidationTranslator = (key) => DEFAULTS[key] ?? key

export const billingTypeSchema = z.enum(['individual', 'company'])
export type BillingType = z.infer<typeof billingTypeSchema>

function buildShippingShape(t: ValidationTranslator) {
  return {
    firstName: z.string().min(1, t(VALIDATION_KEYS.firstName)),
    lastName: z.string().min(1, t(VALIDATION_KEYS.lastName)),
    email: z.string().email(t(VALIDATION_KEYS.email)),
    phone: z.string().refine((v) => isValidRomanianPhone(v), t(VALIDATION_KEYS.phone)),
    county: z.string().min(1, t(VALIDATION_KEYS.county)),
    city: z.string().min(1, t(VALIDATION_KEYS.city)),
    address: z.string().min(1, t(VALIDATION_KEYS.address)),
    country: z.string().min(1, t(VALIDATION_KEYS.country)),
    postalCode: z.string().min(1, t(VALIDATION_KEYS.postalCode)),
    // Billing type — defaults to individual; "company" requires companyName + companyCui + companyRegCom.
    billingType: billingTypeSchema.optional().default('individual'),
    companyName: z.string().optional(),
    companyCui: z.string().optional(),
    companyRegCom: z.string().optional(),
    // Alternative shipping address — when true, alt* fields below become required and the customer
    // is delivered to the alt address while the primary address is billed/invoiced.
    useAltShipping: z.boolean().optional().default(false),
    altAddress: z.string().optional(),
    altCity: z.string().optional(),
    altCounty: z.string().optional(),
    altPostalCode: z.string().optional(),
    altCountry: z.string().optional(),
  }
}

const baseShippingShape = buildShippingShape(defaultT)

// Pre-refinement object schema. Exported so `checkoutShippingDraftSchema`
// (and any other consumer needing `.partial()`/`.pick()`) can compose on top.
// Zod refuses to apply `.partial()` once a `.superRefine()` chain is attached.
export const shippingObjectSchema = z.object(baseShippingShape)

function shippingRefinement(t: ValidationTranslator) {
  return (data: z.infer<typeof shippingObjectSchema>, ctx: z.RefinementCtx) => {
    if (data.billingType === 'company') {
      if (!data.companyName?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.companyName), path: ['companyName'] })
      }
      if (!data.companyCui?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.companyCui), path: ['companyCui'] })
      }
      if (!data.companyRegCom?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.companyRegCom), path: ['companyRegCom'] })
      }
    }
    if (data.useAltShipping) {
      if (!data.altAddress?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.altAddress), path: ['altAddress'] })
      }
      if (!data.altCity?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.altCity), path: ['altCity'] })
      }
      if (!data.altCounty?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.altCounty), path: ['altCounty'] })
      }
      if (!data.altPostalCode?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.altPostalCode), path: ['altPostalCode'] })
      }
      if (!data.altCountry?.trim()) {
        ctx.addIssue({ code: 'custom', message: t(VALIDATION_KEYS.altCountry), path: ['altCountry'] })
      }
    }
  }
}

export const shippingSchema = shippingObjectSchema.superRefine(shippingRefinement(defaultT))

// Translator factory — pass a `t` function from the form to get
// localized error messages without touching the server defaults.
export function getShippingSchema(t: ValidationTranslator) {
  return z.object(buildShippingShape(t)).superRefine(shippingRefinement(t))
}

export type ShippingData = z.infer<typeof shippingSchema>

// Server-trust: `quantity` feeds the charged totals, the Revolut amount and
// the Meta CAPI Purchase value. Bound it so a tampered `quantity: 1e15` can't
// mint an "order" whose totalPrice overflows safe integer arithmetic.
export const MAX_ORDER_ITEM_QUANTITY = 999

export const orderItemSchema = z.object({
  id: z.string(),
  productType: z.enum(['furniture', 'lighting', 'outdoor']),
  productName: z.string(),
  quantity: z.number().int().positive().max(MAX_ORDER_ITEM_QUANTITY),
  unitPrice: z.number().nonnegative(),
  slug: z.string().min(1),
  shortName: z.string().min(1),
})

export type OrderItem = z.infer<typeof orderItemSchema>

export const paymentMethodSchema = z.enum(['cod', 'card'])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const checkoutPaymentUiVariantSchema = z.enum(['control', 'compact_payment_options'])
export type CheckoutPaymentUiVariant = z.infer<typeof checkoutPaymentUiVariantSchema>

export const checkoutExperimentsSchema = z.object({
  checkoutPaymentUi: checkoutPaymentUiVariantSchema.optional(),
}).strict()
export type CheckoutExperimentsData = z.infer<typeof checkoutExperimentsSchema>

const metaTrackingValueSchema = z.string().trim().min(1).max(512)

export const metaTrackingSchema = z.object({
  fbp: metaTrackingValueSchema.optional(),
  fbc: metaTrackingValueSchema.optional(),
  externalId: metaTrackingValueSchema.optional(),
}).strict()

export type MetaTrackingData = z.infer<typeof metaTrackingSchema>

// Server-trust: regex restricts to the alphabet emitted by `coupons.generateCouponCode`.
// Mongo lookup uppercases the input — keep the regex case-insensitive on input.
export const couponCodeSchema = z
  .string()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, defaultT(VALIDATION_KEYS.coupon))

export const orderRequestSchema = z.object({
  shipping: shippingSchema,
  // Upper bound mirrors `cartSyncSchema.items` — no legitimate checkout
  // carries more than 50 distinct lines.
  items: z.array(orderItemSchema).min(1, defaultT(VALIDATION_KEYS.orderItems)).max(50),
  // Client-supplied price is informational only — server always recomputes from items.
  totalPrice: z.number().positive().optional(),
  paymentMethod: paymentMethodSchema.optional().default('cod'),
  // GDPR marketing consent at order-submission time. Used to gate Meta CAPI
  // Purchase events. Default-deny when omitted (legacy clients pre-banner).
  marketingConsent: z.boolean().optional().default(false),
  // Recovery-coupon code from the H24/H72 email. Server re-validates and
  // atomically redeems before applying the discount.
  couponCode: couponCodeSchema.optional(),
  // Browser IDs for Meta CAPI match quality. These are not PII hashes: `_fbc`
  // contains the Meta click ID and must be preserved case-sensitively.
  tracking: metaTrackingSchema.optional(),
  // Site-side A/B experiment assignments. The server also reads the
  // first-party cookie, but the body keeps order persistence explicit.
  experiments: checkoutExperimentsSchema.optional(),
  // Active Meta Test Events session token (e.g. TEST1406). Forwarded by the
  // browser when the tester opened the site with ?test_event_code=… so the
  // server-side Purchase CAPI call surfaces in Events Manager → Test Events
  // instead of leaking into the production stream. Format gate matches the
  // browser-side regex in analytics.ts:getMetaTestEventCode.
  testEventCode: z.string().trim().regex(/^TEST[A-Z0-9]{1,32}$/).optional(),
})

export type OrderRequest = z.infer<typeof orderRequestSchema>

export const captureEmailSchema = z.object({
  email: z.string().email(defaultT(VALIDATION_KEYS.email)),
  source: z.string().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
})

export type CaptureEmailData = z.infer<typeof captureEmailSchema>

// Cart-context items carry an `image` URL that the order item shape doesn't.
// Sync accepts the wider shape so we don't need a parallel type for transit.
export const cartItemSchema = orderItemSchema.extend({
  image: z.string().max(2048).optional(),
})

export const cartSyncSchema = z.object({
  cartId: z.string().uuid().optional(),
  items: z.array(cartItemSchema).max(50),
  subtotal: z.number().nonnegative().max(10_000_000),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  marketingConsent: z.boolean().optional().default(false),
  // Anti-bot token: presence is the signal, not the contents.
  botCheck: z.string().min(3).max(1024),
})

export type CartSyncData = z.infer<typeof cartSyncSchema>

export const applyCouponSchema = z.object({
  code: couponCodeSchema,
  email: z.string().email(),
})
export type ApplyCouponData = z.infer<typeof applyCouponSchema>

export const reviewSubmitSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(2, defaultT(VALIDATION_KEYS.firstName)).max(80),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  text: z.string().min(10).max(2000),
  email: z.string().email().optional().or(z.literal('')),
  // Signed `orderId|slug` token from the review-request email CTA — see
  // lib/orders/review-token.ts. Absent for organic (non-invited) reviews.
  rt: z.string().max(512).optional(),
  // Honeypot: a real visitor never fills this (hidden via CSS). Non-empty ⇒ bot.
  company: z.string().max(200).optional(),
})
export type ReviewSubmitData = z.infer<typeof reviewSubmitSchema>
