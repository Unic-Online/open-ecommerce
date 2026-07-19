<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.2.1) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Storefront i18n template — agent operating manual

An opinionated, fully de-branded Next.js 16 e-commerce storefront. The demo brand
is **"Acme Store"**; every brand/business value is swappable from a single config
file without touching the ~40 downstream consumers. This document is the technical
reference for AI agents working on the template. `CLAUDE.md` re-exports it.

**Golden rule:** the source code is the source of truth. This file summarizes it,
but VERIFY details against the actual files (especially `src/site.config.ts`,
`src/env.ts`, `content/products/*`) before relying on a summary.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js **16.2.1** (App Router) |
| UI | React **19.2.4**, CSS Modules |
| i18n | next-intl **4** (locales `en` + `ro`, default `en`) |
| DB | MongoDB (`mongodb` v7) |
| Email | Resend |
| Payments | Revolut Merchant API v2 (Web SDK inline widgets) |
| Validation | Zod **4** |
| Carousel | Embla |
| Analytics | Meta Pixel + CAPI (server-side), GTM/GA4, Grafana Faro (browser RUM) |
| Test | Vitest (unit/integration) + Playwright (e2e) |
| Package manager | **pnpm** |

## File map

```
storefront-i18n/
├── src/
│   ├── site.config.ts        # THE config (brand, markets, categories, storage, features, …)
│   ├── env.ts                # validated env layer (serverEnv getters + clientEnv literals)
│   ├── app/[locale]/         # localized routes (thin category wrappers + checkout/account/etc.)
│   ├── app/admin/            # admin dashboard (auth-gated, feature-flagged)
│   ├── app/api/              # route handlers (order, contact, payments, webhooks, cron, admin)
│   ├── components/
│   │   ├── category-page/    # CategoryListingPage + CategoryProductPage (shared, drive all categories)
│   │   ├── product-template/ # product page UI (gallery, lightbox, buy-box, description)
│   │   └── reviews/          # review section
│   ├── data/products/        # catalog.ts + prices.ts (DERIVED from content/products at import)
│   ├── i18n/                 # routing.ts, locales.ts, market-config.ts, market-resolver.ts, request.ts
│   ├── lib/                  # pricing, contacts, mongodb, resend, validation, emails/, constants, …
│   ├── plugins/abandoned-cart/  # self-contained cart-recovery plugin (see its own README)
│   └── styles/               # theme.css (+ theme-warm.css, theme-mono.css) — design tokens
├── content/products/         # ONE file per product (defineProduct) + index.ts registry
├── messages/{en,ro}/         # next-intl message namespaces (one JSON per namespace)
├── public/images/<slug>/     # product images (1.jpg, 2.jpg, …) + logo.svg
├── scripts/                  # sync-docs.mjs, revolut-webhook.mjs, backfill/validator helpers
├── docs/                     # Revolut setup + OpenAPI spec
├── e2e/                      # Playwright specs
├── .env.example              # curated env reference (verified by sync-docs)
├── instrumentation.ts        # prod cold-start env preflight (assertProdEnvOrThrow)
└── vercel.json               # cron schedules
```

## THE config: `src/site.config.ts`

This is the one file an operator (or agent) edits to rebrand the whole template.
It is **pure data + types only** — it MUST stay importable from both client and
server bundles, so it never imports `next/headers` or anything server-only.
Request-aware helpers live in `src/i18n/market-resolver.ts`; pure locale→market
helpers in `src/i18n/market-config.ts`.

What lives there:

| Export | Purpose |
|---|---|
| `locales`, `defaultLocale` | UI languages (`['en','ro']`, default `en`). |
| `categories` | Product taxonomy registry. Each entry: `key`, per-locale `pathnames`, per-locale `labels`. Drives routes, nav, listings. `key` IS the cart product-type id; catalog ids are `${key}__${slug}`. |
| `MARKETS`, `DEFAULT_MARKET` | Commercial markets (`english` default on `shop.example.com`/EUR, `ro` on `ro.shop.example.com`/RON). Each market: `domain`/`domainAliases`/`baseUrl`, `currency`, `shipping` (cost/threshold/countries), `checkout` (enabled + payment methods), `contact` (emails, WhatsApp, merchant notification list), `legal`, `analytics` (per-market GA/Pixel overrides), optional `googleMerchant`. |
| `brand` | `siteName` + header/footer logo paths (`/logo.svg`). |
| `analytics` | Top-level GA id (env-driven; ships unset). |
| `storage` | All browser/DB namespacing: localStorage keys (`sf_*`), `consentLocalStoragePrefix` (`sf_consent_`), cookie names (`sf_cart_id`, `sf_admin_session`), `mongoDbName` (`storefront`). Changing a value re-namespaces (and invalidates) existing state. |
| `commerce` | `couponPrefix` (`SHOP`) → recovery coupon codes are `SHOP-XXXX-XXXX`. |
| `features` | Master switches: `admin`, `abandonedCart`, `analytics`, `merchantFeed`, `accounts`. `false` makes a subsystem inert (404 / unmounted) without breaking build or tests. |
| `trademark` | Optional registered-trademark metadata; `undefined` in the demo (renders nothing). |
| `SPRING_SALE_END_ISO` | Seasonal sale countdown end. |

## How-to

### Rebrand

1. Edit `src/site.config.ts`: `brand.siteName`, each `MARKETS[*].name` / `domain` / `baseUrl` / `contact` / `legal`, `categories` labels+pathnames, and (optionally) `storage` namespacing + `commerce.couponPrefix`. Changing `storage` values resets existing browser/DB state — migrate or accept the reset.
2. Replace `public/logo.svg` (header + footer both point at it by default).
3. Grep `messages/{en,ro}/**` for the brand string and update user-facing copy: `grep -rni "acme" messages/`.
4. Run `pnpm build` + `pnpm test`.

### Add a product

One content file + one registry line + images. Everything else (prices, catalog
entry, routes, search, sitemap, merchant feed) derives automatically from the
registry and the category config.

1. Create `content/products/<slug>.ts`:

```ts
import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'aria-console',
  category: 'furniture', // MUST be a registered category key
  business: {
    inStock: true,
    reviewsKey: 'aria-console',          // optional — links reviews
    popularSlugs: ['oslo-nightstand'],   // optional — upsell suggestions
    prices: {
      english: { price: 249, oldPrice: 299, currency: 'EUR' },
      ro: { price: 1199, oldPrice: 1399, currency: 'RON' },
      // omit a market to make the product unpurchasable there
    },
  },
  locales: {
    en: {
      shortName: 'Aria Console',
      fullTitle: 'Aria Oak Console Table',
      tagline: 'Slim hallway console in solid oak',
      shortDescription: 'A narrow solid-oak console table for hallways and entryways.',
      badge: 'New',                         // optional
      availabilityNote: 'In stock — ships in 2–4 business days',
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Furniture', href: '/furniture' },
      ],
      categoryLink: { label: 'Furniture', href: '/furniture' },
      gallery: [
        { src: '/images/aria-console/1.jpg', label: 'Aria Console — front view', aspect: '1/1' },
        { src: '/images/aria-console/2.jpg', label: 'Aria Console — side detail', aspect: '1/1' },
      ],
      description: [
        { kind: 'paragraph', lead: true, body: 'The **Aria Console** is a slim oak table…' },
        { kind: 'heading', text: 'Specifications' },
        { kind: 'specList', specs: [{ label: 'Material', value: 'Solid oak' }] },
        // also available: bulletList, miniList, image, pdfDownload
      ],
      reviews: [ /* optional — { id, name, location, rating, title, text, date, … } */ ],
    },
    ro: {
      // same shape, Romanian copy. Omit a locale to hide the product in that locale.
      shortName: 'Consolă Aria',
      fullTitle: 'Consolă din Stejar Aria',
      tagline: 'Consolă îngustă din stejar masiv',
      shortDescription: 'O consolă îngustă din stejar masiv pentru hol.',
      breadcrumb: [
        { label: 'Acasă', href: '/' },
        { label: 'Mobilier', href: '/mobilier' },
      ],
      categoryLink: { label: 'Mobilier', href: '/mobilier' },
      gallery: [{ src: '/images/aria-console/1.jpg', label: 'Consolă Aria', aspect: '1/1' }],
      description: [{ kind: 'paragraph', lead: true, body: 'Consola **Aria**…' }],
    },
  },
});
```

2. Register it in `content/products/index.ts` (one import + one array entry in `PRODUCTS`).
3. Drop images in `public/images/<slug>/` (numbered `1.jpg`, `2.jpg`, …) matching the `gallery` `src` paths.

`defineProduct` Zod-validates the literal at module load and throws with the slug
baked in if malformed. The catalog id is `${category}__${slug}`; prices/catalog
are rebuilt from `PRODUCTS` in `src/data/products/{prices,catalog}.ts`.

### Add a category

1. Add an entry to `categories` in `src/site.config.ts` (`key`, per-locale `pathnames` starting with `/` and unique, per-locale `labels`).
2. Create two thin route files — they pass only the category key to the shared components:

```tsx
// src/app/[locale]/<key>/page.tsx — listing
import type { Metadata } from 'next';
import CategoryListingPage from '@/components/category-page/CategoryListingPage';
import { categoryListingMetadata } from '@/components/category-page/helpers';
import type { LocaleKey } from '@/i18n/locales';

export const revalidate = 3600;
type Params = { params: Promise<{ locale: LocaleKey }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return categoryListingMetadata(locale, '<key>');
}
export default async function Page({ params }: Params) {
  const { locale } = await params;
  return <CategoryListingPage locale={locale} category="<key>" />;
}
```

```tsx
// src/app/[locale]/<key>/[slug]/page.tsx — detail
import type { Metadata } from 'next';
import CategoryProductPage from '@/components/category-page/CategoryProductPage';
import { categoryProductMetadata, categorySlugParams } from '@/components/category-page/helpers';
import type { LocaleKey } from '@/i18n/locales';

export const revalidate = 3600;
type Params = { params: Promise<{ locale: LocaleKey; slug: string }> };

export function generateStaticParams() {
  return categorySlugParams('<key>');
}
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  return categoryProductMetadata(locale, '<key>', slug);
}
export default async function Page({ params }: Params) {
  const { locale, slug } = await params;
  return <CategoryProductPage locale={locale} category="<key>" slug={slug} />;
}
```

`src/i18n/routing.ts` (`buildCategoryPathnames()`) auto-generates the localized
`/<key>` and `/<key>/[slug]` pathnames from the config — no manual `pathnames`
edits needed.

### Add a locale

1. Add the locale to `locales` in `src/site.config.ts` (and set `defaultLocale` if changing the default).
2. Add a per-locale `pathnames` + `labels` entry to **every** `categories` item, and the locale's value to any market that should serve it.
3. Create `messages/<locale>/<namespace>.json` for every namespace under `messages/en/`.
4. Add the locale key to each product's `locales` in `content/products/*` (a product with no entry for a locale is hidden in that locale).

### Switch / edit theme

The whole design system is CSS custom properties in `src/styles/theme.css`.
Two alternates ship: `theme-warm.css`, `theme-mono.css`. Switch by editing the
single `@import` at the top of `src/app/globals.css`:

```css
@import '../styles/theme.css';   /* → '../styles/theme-warm.css' or '-mono.css' */
```

Edit tokens in place to customize. The storefront is light-only (no theme state,
`data-theme`, or theme localStorage key).

### Toggle features

Flip a flag in `features` (`src/site.config.ts`). `false` makes the subsystem
inert without breaking build/tests (gated at layout/route level via server-side
`notFound()` / unmounted client roots):

- `admin` — `/admin/**` pages + `/api/admin/**` (404 when off).
- `abandonedCart` — exit-intent popup, cart sync, recovery cron + endpoints. Master switch above the `NEXT_PUBLIC_ABANDONED_CART_*` env sub-toggles.
- `analytics` — Meta Pixel, GTM/GA, Faro, Meta CAPI route + replay cron. (The GDPR consent banner is NOT analytics — it stays on.)
- `merchantFeed` — `/google-merchant.xml` (404 when off).
- `accounts` — `/account` + `/api/account/**` + header account link.

## Environment variables

Single source of truth: `src/env.ts` (`serverEnv` live getters + `clientEnv`
inlined literals). The curated `.env.example` documents every one. Production
cold start validates the required set via `instrumentation.ts → assertProdEnvOrThrow()`
(no-op in dev/preview/test). `pnpm sync-docs` verifies `.env.example` covers
every `process.env.X` in `src/`.

**Required for checkout** (validated at prod boot — see `REQUIRED_PROD_ENV`):

| Var | Used by | Notes |
|---|---|---|
| `MONGODB_URI` | `lib/mongodb.ts` | Atlas SRV connection string. DB name defaults to `storefront` (`site.config.storage.mongoDbName`), overridable via `MONGODB_DB_NAME`. |
| `RESEND_API_KEY` | `lib/resend.ts` | Transactional email + audience sync. |
| `REVOLUT_SECRET_KEY` | `lib/revolut.ts` | Merchant API secret (`sk_…`), server-only. |
| `REVOLUT_WEBHOOK_SIGNING_SECRET` | `api/webhooks/revolut` | HMAC verify; handler rejects all until set. From `pnpm revolut:webhook create`. |
| `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` | `RevolutPaymentWidgets.tsx` | Browser SDK public key (`pk_…`); absent ⇒ widgets show "not configured". |
| `ADMIN_PASSWORD` | admin auth | Single operator password. |
| `CART_RECOVERY_HMAC_SECRET` | admin session / account magic-links / recovery URLs | Shared secret; rotating it logs everyone out + invalidates recovery links. |
| `CART_RECOVERY_CRON_SECRET` | cron routes | Bearer the Vercel cron sends to authorize recovery + CAPI-replay. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Pixel + CAPI | Required in prod: a missing id silently drops every Purchase conversion. |
| `META_CAPI_ACCESS_TOKEN` | `api/meta-capi` | Server-side CAPI token. |

**Optional** (absent ⇒ feature silently disables): `MONGODB_DB_NAME`,
`REVOLUT_API_MODE` / `NEXT_PUBLIC_REVOLUT_API_MODE` (`sandbox`/live),
`NEXT_PUBLIC_GTM_ID`, `META_CAPI_TEST_EVENT_CODE`, `META_CAPI_DISABLE_SERVER_PURCHASE`,
`NEXT_PUBLIC_FARO_URL` / `NEXT_PUBLIC_FARO_APP_NAME` (default app name `storefront`),
`ERROR_SINK_URL` / `ERROR_SINK_TOKEN`, the `NEXT_PUBLIC_ABANDONED_CART_*` client
flags, `ABANDONED_CART_DRY_RUN` / `ABANDONED_CART_RECOVERY_EMAIL_ENABLED` /
`RECOVERY_EMAIL_DRY_RUN`, `EMAIL_DRY_RUN`, `E2E_DEBUG_ENDPOINTS`. See `.env.example`
for the curated, grouped list. `NODE_ENV` + Vercel platform vars are read directly
(not routed through `env.ts`).

## Storage (MongoDB + browser)

DB name from `site.config.storage.mongoDbName` (default `storefront`, e2e overrides
to an isolated DB via `MONGODB_DB_NAME`). Verify field lists against
`src/lib/contacts.ts`, `src/lib/consent.ts`, and `src/plugins/abandoned-cart/server/`.

- **`contacts`** — one doc per email (unique, lowercased `email`). `createdAt`, `updatedAt`, `source` (default `'website'`), optional `firstName`/`lastName`/`lastOrderId`/`lastOrderAt`/`orderCount`. Mirrored to the Resend audience on `upsertContact()`.
- **`orders`** — one doc per order. `orderId` (8-hex, **unique index** — `ensureOrderIdIndex` in `lib/orders/order-id.ts`; on an 11000 collision `saveOrder` regenerates the id and retries, max 3 attempts), `email`, `createdAt`/`updatedAt`, optional `cartId`, `shipping`, `items`, and server-recomputed `subtotal`/`discount`/`shippingCost`/`totalPrice` (`lib/pricing.ts` — client prices are never trusted). `paymentMethod` ∈ `'ramburs'|'card'`. `status` ∈ `'pending_payment'|'paid'|'cancelled'|'failed'|'received'|'refunded'`; transitions go through `lib/orders/status-machine.ts`; `cancelled`/`refunded` are terminal (`updateOrderPayment` filters `$nin:['cancelled','refunded']` so a late webhook can't overwrite a manual terminal status). Optional `market`/`locale`/`currency`/`domain`. `emailSentAt` (set-once idempotency) + `emailSend*` attempt markers. Optional `clientIp`/`clientUserAgent`, `marketingConsent` (gates server Meta CAPI Purchase), `testEventCode`, `metaCapi.purchase` (`{sentAt?,attempts,lastError?,lastAttemptAt?}`). Card-only `payment` (`{providerOrderId,providerPublicId,providerCheckoutUrl,state,paidAt,lastWebhookEvent,…}`). Admin-written `fulfillment` (`{status:'unfulfilled'|'shipped'|'delivered',carrier?,trackingNumber?,…,shipmentEmailSentAt?}`), `notes[]`, `auditLog[]`, `refund` (`{amount,reason?,reference?,refundedAt}`).
- **`consents`** — append-only GDPR audit (`insertOne` only). `version`, `analytics`, `marketing`, `source` ∈ `'banner_accept_all'|'banner_decline_all'|'banner_customize'|'footer_link'`, `givenAt`, optional `clientIp`/`clientUserAgent`/`email`, `createdAt`.
- **`carts`** (abandoned-cart plugin) — key `cartId` (UUIDv4, mirrored to cookie `sf_cart_id`). `items`, `subtotal`, `locale`, optional `market`/`email`/`phone`/`ipAddress`/`userAgent`, `marketingConsent`, `status` ∈ `'active'|'abandoned'|'recovered'|'completed'` (`completed` is locked), `recoveryStep` 0–3, `recoveryEmails[]`, optional `couponCode`, `createdAt`/`lastActivityAt`/`abandonedAt?`/`recoveredAt?`/`completedAt?`/`orderId?`.
- **`cart_coupons`** — recovery coupons. `code` (unique, format `SHOP-XXXX-XXXX` from `commerce.couponPrefix`; alphabet excludes ambiguous chars), `cartId`, `email`, `discountPercent` (stacks on the welcome discount), `maxUses` (1), `usedCount`, `validFrom`/`validUntil`, optional `redeemedAt`/`redeemedOrderId`. Redemption is atomic (`findOneAndUpdate` on `usedCount:0`).
- **`reviews`** — customer reviews, one doc per submission (`lib/reviews-store.ts`). Fields: `slug`, `reviewsKey?`, `name`, `email?`, `rating` (1-5), `title?`, `text`, `locale`, `market?`, `status: 'pending'|'approved'|'declined'`, `verifiedPurchase`, `orderId?`, `clientIp?`, `clientUserAgent?`, `createdAt`, `decidedAt?`. Every `POST /api/reviews` submission lands `pending`; only `/admin/reviews` (via `decideReview`, atomic on `status:'pending'`) moves it to `approved`/`declined` — `declined` stays in the DB (audit) but is never shown. `getApprovedReviews(slug, locale)` reads by `slug` (NOT `reviewsKey` — that's only the indirection the curated/static corpus in `data/reviews-registry.ts` uses); `getMergedReviews` combines both sources for the product page. `verifiedPurchase: true` implies an `orderId` — a unique partial index on `{orderId, slug}` (only when `orderId` exists) blocks a second verified review for the same order+product. The `?rt=` token in the review-request email (`lib/orders/review-token.ts`, HMAC over `{orderId, slug, exp}`) is what raises `verifiedPurchase` — an invalid/expired/mismatched token degrades to unverified rather than rejecting the submission.

Browser state (keys from `site.config.storage`): localStorage cart `storefront-cart`,
`sf_user_email`, `sf_email_popup_dismissed`, the `sf_exit_intent_*` family, consent
`sf_consent_v<version>`. Cookies: `sf_cart_id` (UUIDv4, SameSite=Lax, 90d, not
httpOnly), `sf_admin_session` (HMAC-signed).

## Pricing & discounts

`src/lib/pricing.ts` is the single source of truth (server-trust — the client never
decides the charged amount). Constants: `WELCOME_DISCOUNT` (0.10 / `WELCOME_DISCOUNT_PERCENT`
10), `STANDARD_SHIPPING_COST` (29), `FREE_SHIPPING_THRESHOLD` (600). The active market's
`shipping.standardCost`/`freeThreshold` in `site.config` mirror these for the RO market.
`computeOrderTotal()` returns `{subtotal,discount,shippingCost,total}`; recovery coupon
percent (0–80) stacks on the welcome discount, total capped at 95%. If the commercial
model changes, update together: `lib/pricing.ts`, the market `shipping` config, checkout
+ popup copy (`messages/`), and any test asserting totals.

## Conventions

- **Imports**: alias `@/*` → `src/*`. Always absolute, never `../../../`.
- **Server vs client**: components using `useState`/`useEffect`/cart/Pixel start with `'use client'`. Pages are server components by default and may export `metadata`.
- **CSS**: CSS Modules per component (`Foo.module.css` beside `Foo.tsx`). Global styles only in `app/globals.css`. Design tokens only in `src/styles/theme*.css`.
- **i18n**: user-facing strings live in `messages/{locale}/<namespace>.json` and product content in `content/products/*`. Code identifiers/comments may be English.
- **Config single-source**: brand/business/market values live in `src/site.config.ts` (re-exported by `src/lib/constants.ts`, `src/i18n/*`). Do not duplicate them in components.
- **Validation single-source**: `src/lib/validation.ts` (Zod). Use the same schema on client (forms) and server (API routes). Never duplicate email/phone regex.
- **Email templates**: pure functions in `src/lib/emails/<name>.ts` that take an object and return a string. Never concatenate HTML inline in route handlers. All sends go through `sendEmail()` in `src/lib/resend.ts` — never call `getResend().emails.send` directly.
- **Server-trust pricing**: recompute totals server-side from Zod-validated line items. Client-supplied prices are informational only.
- **Theme**: light-only. Do not reintroduce theme state / `data-theme` / a theme storage key.
- **Abandoned-cart isolation**: all cart-recovery logic lives under `src/plugins/abandoned-cart/` behind the single `<AbandonedCartPlugin />` mount. Do not scatter it into `components/` or `lib/`. Reflect changes in the plugin's README.
- **Comments**: TSDoc header only on contract-bearing modules in `lib/` and `plugins/server/` (see `lib/pricing.ts`, `lib/contacts.ts`, `lib/consent.ts`): one-line summary + `Invariants:` / `Side effects:` / `Caller contract:` bullets. Inline `// Why:` / `// Invariant:` / `// Atomic:` / `// Server-trust:` / `// GDPR:` anchors only at non-obvious branches. No identifier-restating, no caller lists, no PR/issue refs, no banner separators. `// TODO(owner): why` or no TODO.

## Testing

- **Vitest** (`pnpm test`) — unit + integration with mocks (DB, fetch). Files in `src/__tests__/**/*.test.{ts,tsx}`.
- **Shared mocks + data builders** (`src/__tests__/helpers/`): do NOT hand-roll `vi.mock('@/lib/mongodb', ...)` / `vi.mock('resend', ...)` blocks or inline order docs. Use `mongoMock` (`vi.mock('@/lib/mongodb', () => mongoMock.module())`, then `mongoMock.collection('orders').findOne.mockResolvedValueOnce(...)`), `resendLibModule()` / `resendPackageModule()` + `sendEmailMock`, `setWindowConsent()`, and the builders (`buildOrder`, `buildCart`, `buildShipping`, `buildOrderLine`, `buildCartItem`) with per-field overrides. Vitest runs with `clearMocks` + `restoreMocks` and the setup wipes `localStorage`/`sessionStorage` after every test — never rely on state leaking between tests.
- **Playwright** (`pnpm test:e2e`) — real-browser e2e. Files in `e2e/`. `playwright.config.ts` boots the dev server with an isolated `MONGODB_DB_NAME` + email/Revolut dry-run flags, so the suite runs without API keys. UI mode: `pnpm test:e2e:ui`. `e2e/` is excluded from `tsconfig.json` (not compiled by Next build).
- For endpoints depending on external services, use/extend `e2e/fixtures/api-mocks.ts` — do not add sandbox keys to config.

## AI rules (when you change code)

1. **Add an env var** (`process.env.X`) → add a literal getter/field in `src/env.ts` and document it in `.env.example` (curated by hand — keep the grouping/comments), then run `pnpm sync-docs` (it fails if `.env.example` is missing a var).
2. **Add/change a route** → no codegen needed; `pnpm sync-docs --routes` prints the current route list for reference.
3. **Add a product** → see "Add a product" (one content file + registry line + images). Do NOT edit the per-product UI template — `components/product-template/` + `components/category-page/` are shared across all products.
4. **Add a category** → see "Add a category" (config entry + two thin route files). Routing pathnames derive from config.
5. **Change a Mongo collection schema** (`contacts`, `orders`, `consents`, `carts`, `cart_coupons`, `reviews`) → update the Storage section above.
6. **Add a tracking event** → use `src/lib/analytics.ts`. Don't put tracking logic in components.
7. **Validation** → never duplicate email/phone regex; use `src/lib/validation.ts`.
8. **Theme** → no theme state / `data-theme` / theme storage key. The storefront is light-only.
9. **E2E required for user-facing features** → any new route / popup / form / live-traffic route handler needs at least one Playwright spec under `e2e/`. Don't mark a task done without `pnpm test:e2e` + `pnpm test` (use the e2e API mocks for external services).
10. **Abandoned-cart plugin** → cart-recovery changes go in `src/plugins/abandoned-cart/` and are reflected in its README. Don't duplicate logic in `components/`/`lib/`.
11. **Brand/business values** → change them in `src/site.config.ts`, never hardcode in components.
