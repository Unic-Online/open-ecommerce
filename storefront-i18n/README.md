# Storefront i18n template

An opinionated, production-grade **Next.js 16** e-commerce storefront you can fork
and rebrand. It ships as a fully de-branded demo (**"Acme Store"**, English + Romanian)
with everything wired: internationalized catalog, Revolut card payments, MongoDB
persistence, Resend transactional email, a password-protected admin dashboard,
abandoned-cart recovery, analytics, and a token-based theming system.

Every brand/business value lives in one file (`src/site.config.ts`). Swap the
values, drop in your products, and deploy.

> New to the codebase? `AGENTS.md` is the technical reference (file map, config,
> how-to guides, env vars, storage schema, conventions). This README is the
> human-facing overview + quickstart + deploy guide.

## Features

- **i18n storefront** — next-intl with locales `en` + `ro` (default `en`), localized
  routes (`/furniture` ↔ `/mobilier`), and per-market currency/shipping/legal config.
- **Config-driven everything** — brand, logos, markets, product categories, storage
  namespacing, commerce defaults, and feature flags all live in `src/site.config.ts`.
- **Product catalog** — one file per product (`content/products/<slug>.ts`),
  typed + Zod-validated, with per-market pricing and per-locale content (gallery,
  description blocks, reviews). Prices, catalog, routes, search, and the merchant
  feed all derive automatically.
- **Card payments** — Revolut Merchant API v2 via the Web SDK: Revolut Pay,
  Apple Pay, Google Pay, and an inline card iframe, confirmed by signed webhook.
  Cash-on-delivery (ramburs) is also supported per market.
- **Server-trust pricing** — totals are always recomputed server-side from
  validated line items; the client never decides the charged amount.
- **Abandoned-cart recovery** — a self-contained plugin: exit-intent popup,
  server-side cart persistence, a 3-step recovery email funnel (1h/24h/72h) via
  Resend + Vercel Cron, and single-use stacking discount coupons.
- **Admin dashboard** — password-gated `/admin`: orders (filters, KPIs, CSV export,
  fulfillment, refunds, notes, audit log) and the cart-recovery funnel.
- **Analytics, env-optional** — Meta Pixel + server-side Conversions API (with
  event dedup), GTM/GA4, and Grafana Faro browser RUM. All disable cleanly when
  their env vars are absent.
- **GDPR consent** — a consent banner with an append-only audit log that gates
  marketing pixels/CAPI (Google Consent Mode v2 aware).
- **Theming** — the entire design system is CSS custom properties; switch between
  `theme.css` / `theme-warm.css` / `theme-mono.css` by changing one `@import`.
- **Feature flags** — master switches turn `admin`, `abandonedCart`, `analytics`,
  `merchantFeed`, and `accounts` fully inert without breaking the build.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js **16.2.1** (App Router) |
| UI | React **19.2.4**, CSS Modules |
| i18n | next-intl 4 |
| Database | MongoDB Atlas (`contacts`, `orders`, `consents`, `carts`, `cart_coupons`) |
| Email | Resend |
| Payments | Revolut Merchant API v2 |
| Validation | Zod 4 |
| Analytics | Meta Pixel + CAPI, GTM/GA4, Grafana Faro |
| Cron | Vercel Cron |
| Tests | Vitest + Playwright |
| Package manager | pnpm |

## Quickstart

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in values as needed (see below)
pnpm dev                     # http://localhost:3000
```

You can browse the demo store and use the cart **with zero configuration**. To
take real orders, fill in the env vars.

### Works with zero env

- Browsing the localized catalog (`/`, `/furniture`, `/lighting`, `/outdoor`, product pages)
- Add-to-cart, cart sidebar, pricing/discount/shipping breakdown
- Locale switching and themes

### Needs env

| Capability | Required vars |
|---|---|
| Persistence (orders, carts, contacts) | `MONGODB_URI` |
| Card checkout | `REVOLUT_SECRET_KEY`, `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, `REVOLUT_WEBHOOK_SIGNING_SECRET` |
| Transactional + recovery email | `RESEND_API_KEY` |
| Admin dashboard | `ADMIN_PASSWORD`, `CART_RECOVERY_HMAC_SECRET` |
| Recovery / CAPI-replay crons | `CART_RECOVERY_CRON_SECRET` |
| Conversion tracking | `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` |

`.env.example` is grouped (required-for-checkout vs optional) and documents every
variable. In production, a cold-start preflight (`instrumentation.ts`) fails the
deploy in the Vercel logs if a required var is missing — rather than 500ing your
first customer. Dev/preview/test run without the full set.

## Customize

| You want to change… | Edit… |
|---|---|
| Brand, markets, currencies, domains, categories, feature flags, storage keys | `src/site.config.ts` (the one config file) — then replace `public/logo.svg` and grep `messages/` for the brand string |
| Look & feel (colors, spacing, type) | `src/styles/theme.css` (or swap the `@import` in `src/app/globals.css` to `theme-warm.css` / `theme-mono.css`) |
| Products | add `content/products/<slug>.ts`, register it in `content/products/index.ts`, drop images in `public/images/<slug>/` |
| UI copy / translations | `messages/{en,ro}/<namespace>.json` |
| Pricing / discount / shipping rules | `src/lib/pricing.ts` + the market `shipping` config in `src/site.config.ts` |

See `AGENTS.md` for step-by-step "add a product", "add a category", and "add a
locale" recipes.

## Deploy to Vercel

1. **Push to GitHub** and import the repo into Vercel (root = this project).
2. **Set env vars** in the Vercel project settings — at minimum the
   "required for checkout" set from `.env.example`. The prod cold-start preflight
   surfaces any missing ones in the build logs.
3. **Crons** are declared in `vercel.json` and registered automatically on deploy:
   - `/api/cron/cart-recovery` — daily `0 2 * * *`
   - `/api/cron/meta-capi-replay` — daily `30 3 * * *`

   Both are gated by `CART_RECOVERY_CRON_SECRET`.
4. **Configure domains** in `src/site.config.ts` — set each `MARKETS[*].domain`
   (and `baseUrl` / `domainAliases`) to your real hostnames, then add those domains
   to the Vercel project. The next-intl middleware routes hosts to markets.
5. **Set up the Revolut webhook** (API-only — there is no dashboard tab for it):

   ```bash
   pnpm revolut:webhook create https://<your-domain>/api/webhooks/revolut
   ```

   It reads `REVOLUT_SECRET_KEY` / `REVOLUT_API_MODE` from `.env.local`, prints a
   `signing_secret` → paste it into `REVOLUT_WEBHOOK_SIGNING_SECRET` (Vercel +
   `.env.local`) and redeploy. Full runbook (Apple Pay domain verification, sandbox
   testing, signature format): `docs/revolut-payments-setup.md`.

For sandbox testing set `REVOLUT_API_MODE=sandbox` and
`NEXT_PUBLIC_REVOLUT_API_MODE=sandbox` with sandbox keys.

## Testing

```bash
pnpm test         # Vitest — unit + integration (mocked DB/fetch)
pnpm test:e2e     # Playwright — real-browser e2e (boots its own dev server, no API keys needed)
pnpm test:e2e:ui  # Playwright UI mode
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm sync-docs    # verify .env.example covers every process.env.X in src/
```

The Playwright config boots the app with an isolated Mongo DB name plus email and
Revolut dry-run flags, so e2e runs without real credentials.

## Project layout

```
src/site.config.ts     # THE config (brand, markets, categories, storage, features)
src/env.ts             # validated env layer
src/app/[locale]/      # localized routes (thin category wrappers + checkout/account/…)
src/app/admin/         # admin dashboard
src/app/api/           # route handlers (order, payments, webhooks, cron, admin)
src/components/         # shared UI (category-page, product-template, reviews, …)
src/lib/               # pricing, contacts, mongodb, resend, validation, emails/, …
src/plugins/abandoned-cart/  # cart-recovery plugin (own README)
src/styles/            # theme tokens
content/products/      # one file per product + index registry
messages/{en,ro}/      # next-intl strings
public/images/<slug>/  # product images + logo.svg
docs/                  # Revolut setup + OpenAPI spec
```

See `AGENTS.md` for the full technical reference and `src/plugins/abandoned-cart/README.md`
for the cart-recovery plugin.
