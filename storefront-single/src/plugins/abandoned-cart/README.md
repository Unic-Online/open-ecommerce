# Abandoned Cart Plugin

Self-contained plugin for cart-recovery features: exit-intent popup, cart
persistence in MongoDB, recovery email automation via Resend + Vercel Cron,
unique coupon codes, checkout-contact mirror, and admin dashboard at `/admin`.

The single mount point is `<AbandonedCartPlugin />` in `src/app/layout.tsx`.
Every sub-feature is independently toggleable via env flags so the entire
system is one prop change away from being disabled.

## Phase Status

- [x] Phase 0 — scaffolding
- [x] Phase 1 — exit-intent popup
- [x] Phase 2 — cart persistence + bot guard
- [x] Phase 3 — recovery emails + coupons + Vercel Cron
- [x] Phase 4 — checkout contact mirror (`<CheckoutContactSync />`)
- [x] Phase 5 — admin dashboard at `/admin`
- [ ] Phase 6 — anonymization sweeper (deferred)

## Architecture

```
plugins/abandoned-cart/
├── config.ts                    env-driven feature flags (client-safe)
├── index.tsx                    <AbandonedCartPlugin />
├── client/
│   ├── CartSync.tsx             debounced sync to /api/cart/sync
│   ├── CheckoutContactSync.tsx  mirror /checkout email+phone to the cart doc
│   ├── ExitIntentPopup.tsx
│   ├── ExitIntentPopup.module.css
│   └── exit-intent-detector.ts  desktop mouseout + mobile windowed-velocity flick + optional back-intercept
├── server/
│   ├── carts.ts                 MongoDB collection helpers
│   ├── bot-guard.ts             UA blacklist, origin check, botCheck token
│   ├── coupons.ts               coupon generation, validation, redemption
│   ├── recovery-cron.ts         3-step email funnel (H1, H24, H72)
│   ├── recovery-token.ts        HMAC-signed recovery URL tokens
│   ├── admin-auth.ts            HMAC session cookies + password compare
│   └── emails/
│       └── cart-recovery.ts     email templates (H1, H24, H72)
├── shared/
│   └── types.ts                 CartDoc, CouponDoc, CartStatus, RecoveryStep
└── README.md
```

API routes (outside the plugin, in `src/app/api/`):
- `POST /api/cart/sync` — persist cart to MongoDB
- `POST /api/cart/apply-coupon` — validate coupon code
- `GET /api/cart/recover/[token]` — verify HMAC, set cookie, return cart items
- `GET /api/cron/cart-recovery` — Vercel Cron: advance recovery funnel
- `POST /api/admin/login` — sign-in (constant-time password compare)
- `POST /api/admin/logout` — clear session cookie
- `GET /recover/[token]` — client wrapper: hydrate localStorage, redirect to `/cart`
- `/admin/*` — auth-gated dashboard (Phase 5)

## Environment Variables

| Variable | Type | Required | Phase | Note |
|----------|------|----------|-------|------|
| `NEXT_PUBLIC_ABANDONED_CART_ENABLED` | `'1'` or unset | yes | 0 | Master switch; disables entire plugin |
| `NEXT_PUBLIC_ABANDONED_CART_EXIT_INTENT` | `'1'` or unset | — | 1 | Desktop mouseout + mobile windowed-velocity flick |
| `NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT` | `'1'` or unset | — | 1 | Experiment: intercept first mobile back press (costs one extra back press; off by default) |
| `NEXT_PUBLIC_ABANDONED_CART_CART_SYNC` | `'1'` or unset | — | 2 | Debounced cart POST to `/api/cart/sync` |
| `NEXT_PUBLIC_ABANDONED_CART_CHECKOUT_DRAFT` | `'1'` or unset | — | 4 | Reserved; the checkout-contact mirror reuses `_CART_SYNC` |
| `ADMIN_PASSWORD` | string | yes (phase 5) | 5 | Login password for `/admin`. Constant-time compared |
| `NEXT_PUBLIC_ABANDONED_CART_TEST_MODE` | `'1'` or unset | — | 1+ | Shrinks cooldowns/timeouts for QA (exit-intent 1h → 0s, recovery 1h → 1min) |
| `ABANDONED_CART_DRY_RUN` | `'1'`, `'0'`, unset | — | 2+ | Unset/`'0'`: live writes. `'1'`: skip DB. Auto-enables if `MONGODB_URI` missing |
| `RECOVERY_EMAIL_DRY_RUN` | `'1'` or unset | — | 3 | Log email intents without calling Resend |
| `ABANDONED_CART_RECOVERY_EMAIL_ENABLED` | `'0'` or unset | — | 3 | Disable email sends (recovery cron still runs) |
| `CART_RECOVERY_HMAC_SECRET` | hex string (32+ chars) | yes (phase 3) | 3 | HMAC key for signed recovery tokens |
| `CART_RECOVERY_CRON_SECRET` | hex string (32+ chars) | yes (phase 3) | 3 | Bearer token for `/api/cron/cart-recovery` |
| `MONGODB_DB_NAME` | string | — | 2+ | Defaults to `storefront`; override to `storefront-e2e` for tests |

## Phase 1: Exit-Intent Popup

Port of CartBounty Pro (WooCommerce plugin). Detects user intent to leave and shows a discount popup.

**Components**: `ExitIntentPopup.tsx`, `exit-intent-detector.ts`

**Triggers** (all require non-empty cart):

- Desktop: `mouseout`/`mouseleave` with `clientY <= 0` (cursor leaving top edge)
- Mobile (Trigger 2): fast upward flick — ≥250px displacement within a 250ms window, ≥3 scroll samples, touch-driven only (replaces UA sniffing). Secondary: slams into y=0 with ≥800px/s after ≥60px. A confirmed tap (`click`) on a link/button suppresses for 1.5s (covers smooth scroll-to-top and cart-lock open/close). Programmatic jumps rejected structurally (< 3 samples).
- Mobile (Trigger 3, optional): back-button intercept via a same-URL history sentinel — enabled by `NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT=1`. First touch arms the sentinel; the next back press shows the popup. If gates fail at pop time, `history.back()` continues automatically so the user is never trapped.

**Cooldown**: closing the popup snoozes it for 1 hour per browser (localStorage `sf_exit_intent_last_shown`). Future prompts are suppressed only while an email is stored in `sf_user_email`. Test mode (`NEXT_PUBLIC_ABANDONED_CART_TEST_MODE=1`) disables cooldown.

**Legacy localStorage keys** (`sf_exit_intent_popup_displayed`, `sf_exit_intent_touches`, `sf_exit_intent_history_clicks`, `sf_exit_intent_touches_object_deleted`, `sf_exit_intent_just_finished_loop`): written by the old CartBounty back-button hijack, now removed. Still cleaned up on detector install so long-lived browsers don't carry stale state. The current back-intercept uses `history.state`, not localStorage.

**Skip paths**: `/checkout`, `/cart`, `/order-confirmation/*` (don't interrupt checkout).

## Phase 2: Cart Persistence

Synchronizes the client-side cart to MongoDB via `<CartSync />`.

**Client**: `CartSync.tsx` POSTs to `/api/cart/sync` on cart changes, debounced 600ms.

**Request body** (includes bot guard):
```json
{
  "cartId": "uuid",
  "items": [...],
  "subtotal": 500,
  "email": "user@example.com",
  "phone": "+40...",
  "marketingConsent": true,
  "botCheck": "<base64 token>"
}
```

**Bot Guard** (`bot-guard.ts`):
1. UA blacklist — 17 patterns (bot, crawl, spider, scrape, etc.). Bots get silent 200.
2. Origin allowlist — every market's primary domain + aliases (derived from `MARKETS` in `src/i18n/market-config.ts`), `localhost:*`, `*.vercel.app`. Adding a market auto-extends the allowlist. Unknown origins get silent 200.
3. `botCheck` token — client emits base64(UA + timestamp). Missing or malformed → silent 200.

**MongoDB**: `carts` collection

| Field | Type | Note |
|-------|------|------|
| `cartId` | UUID | Mirrored to cookie `sf_cart_id` (90 days, SameSite=Lax, NOT httpOnly) |
| `email` | string | Lowercased; required for recovery emails |
| `phone` | string | Optional |
| `items` | CartItemData[] | Synced from client context |
| `subtotal` | number | Cached; recalculated server-side at order time |
| `marketingConsent` | boolean | GDPR flag at sync time |
| `status` | enum | `'active'`, `'abandoned'`, `'recovered'`, `'completed'` |
| `recoveryStep` | 0 \| 1 \| 2 \| 3 | 0: no email sent. 1: H1 sent. 2: H24 sent. 3: H72 sent |
| `createdAt` | Date | First sync |
| `lastActivityAt` | Date | Last sync |
| `abandonedAt` | Date | Flipped to 'abandoned' by cron |
| `recoveredAt` | Date | User returned |
| `completedAt` | Date | Order placed |
| `orderId` | string | Linked when order created |
| `couponCode` | string | Issued in step 2 (reused in step 3) |
| `recoveryEmails` | array | `[{ step, sentAt, messageId }]` |

**Cookie**: `sf_cart_id`
- Format: UUIDv4
- Max-age: 90 days
- SameSite: Lax
- HttpOnly: false (client needs to read it for sync POSTs)

## Phase 3: Recovery Emails + Coupons + Cron

Three-step recovery email funnel with stacking coupons. Cron runs every 15 minutes (Vercel).

**Recovery Flow**:

1. **H1 (1 hour after abandonment)**: "Don't forget your cart" — no coupon.
2. **H24 (24 hours)**: "10% off coupon inside" — coupon issued, valid 7 days.
3. **H72 (72 hours)**: "Final chance" — reuses H24 coupon.

**Coupons** (`coupons.ts`):

Format: `SHOP-XXXX-XXXX` (e.g. `SHOP-AB2K-C9PQ`). Alphabet excludes 0/O and 1/I/L (copy-paste friendly).

| Field | Value | Note |
|-------|-------|------|
| `code` | unique string | Generated randomly |
| `cartId` | UUID | Which cart was abandoned |
| `email` | lowercased | Email restriction — coupon rejected if billing email differs |
| `discountPercent` | 10 | Additional %; stacks on default 10% welcome discount (total 20%) |
| `maxUses` | 1 | Single-use |
| `usedCount` | 0 or 1 | Atomically updated on redemption |
| `validFrom` | Date | Issue time |
| `validUntil` | Date | Issue + 7 days (configurable) |
| `redeemedAt` | Date | When used |
| `redeemedOrderId` | string | Order it was applied to |

**Pricing with Coupon**:

`computeOrderTotal(items, { couponDiscountPercent: 10 })` stacks discounts:
- Base: 10% welcome discount (hardcoded in `lib/pricing.ts`)
- Coupon: 10% (from recovery email)
- Total discount: min(10% + 10%, 95%) = 20%
- Final: `subtotal - discount + shipping`

**Vercel Cron** (`/api/cron/cart-recovery`):

Protected by `Authorization: Bearer $CART_RECOVERY_CRON_SECRET`.

**Schedule** (in `vercel.json`): `0 2 * * *` (daily at 02:00 UTC) — Vercel
Hobby tier only allows one cron run per day. The H1/H24/H72 thresholds in
`recovery-cron.ts` still gate when each step fires, but the actual send
happens on the next daily tick after the threshold passes (so e.g. step 1
lands tomorrow morning for a cart abandoned today). On Vercel Pro switch
to `*/15 * * * *` for ~15-min precision.

**Test mode thresholds** (`NEXT_PUBLIC_ABANDONED_CART_TEST_MODE=1`):
- Abandon after: 1 min (vs 60 min prod)
- H1 after: 1 min
- H24 after: 2 min
- H72 after: 3 min

**Logic** (each tick, per-tick limit 50 carts):

1. Flip `status: 'active'` → `'abandoned'` if `lastActivityAt` is > 1h old and has email + items.
2. Step 1: Find `recoveryStep: 0` carts abandoned > 1h, send H1 (no coupon), advance to step 1.
3. Step 2: Find `recoveryStep: 1` carts abandoned > 24h, issue coupon, send H24, advance to step 2.
4. Step 3: Find `recoveryStep: 2` carts abandoned > 72h, reuse coupon, send H72, advance to step 3.

Invariants:
- **At most one recovery email per cart per tick.** A cart that passes several
  thresholds at once (daily Hobby cron, cron downtime) advances exactly one
  step per run — never H1+H24 back-to-back in the same minute.
- **The atomic step-advance is gated on `status: 'abandoned'`** (not just
  `recoveryStep`), so a cart completed or reactivated between the candidate
  read and the write is never resurrected to 'abandoned' or emailed.

**Recovery URL**: `${SITE_URL}/recover/${HMAC-token}`

Token format (in `recovery-token.ts`):
```
<base64url(JSON.stringify({ cartId, exp }))>.<base64url(hmac-sha256)>
```

Expires 7 days from issue. Verified via `CART_RECOVERY_HMAC_SECRET`.

**Handler** (`src/app/recover/[token]/page.tsx`):
1. Verify token signature and expiry
2. Fetch cart from MongoDB using `cartId`
3. Set `sf_cart_id` cookie
4. Hydrate cart into `localStorage storefront-cart`
5. Redirect to `/cart` (a full-document navigation so CartProvider re-reads the cart)

**Email Templates** (`server/emails/cart-recovery.ts`):

Three renders: `renderRecoveryH1()`, `renderRecoveryH24()`, `renderRecoveryH72()`.

Each returns `{ subject, html }`. Content includes:
- Recovery link: `${SITE_URL}/recover/${token}`
- Cart items + prices
- Coupon code (H24, H72 only)
- CTA: "Recover cart" or "Claim coupon"

## Testing

**Unit tests** (Vitest):
- `src/__tests__/cart-recovery-token.test.ts` — HMAC signing/verification
- `src/__tests__/cart-coupon-pricing.test.ts` — coupon stacking logic
- `src/__tests__/cart-sync-validation.test.ts` — bot guard, cart schema

**E2E tests** (Playwright):
- `e2e/01-navigation.spec.ts` — basic page load
- `e2e/02-cart-sync.spec.ts` — cart persistence to MongoDB
- `e2e/03-exit-intent.spec.ts` — popup triggers (desktop + mobile)
- `e2e/04-recovery-cron.spec.ts` — cron funnel (H1 → H24 → H72)

**Run tests**:
```bash
pnpm test                  # unit tests
pnpm test:e2e              # Playwright (auto-starts dev server on test DB)
```

**Test config** (`playwright.config.ts`):
- Isolated DB: `MONGODB_DB_NAME=storefront-e2e`
- Dry-run mode enabled: `RECOVERY_EMAIL_DRY_RUN=1`, `ABANDONED_CART_RECOVERY_EMAIL_ENABLED=0`
- Resend not called
- Revolut not called
- 4 parallel workers (cart isolation via cookie context)

## Implementation Notes

**Order Completion Hook**:

When an order is placed (either cash-on-delivery or card payment):
1. `/api/order` (cod) — `markCartCompleted(cartId, orderId)`
2. Revolut webhook — same call after payment succeeds
3. Cart status flipped to `'completed'`; future recovery emails skip it

Card path persists `cartId` on order doc so webhook can find the cart.

**Dry-run Auto-Enable**:

`isAbandonedCartDryRun()` returns `true` if:
- `ABANDONED_CART_DRY_RUN=1` explicitly set, OR
- `MONGODB_URI` is missing (local dev without a DB)

Useful for CI/local without a live MongoDB.

**Email Dry-run**:

`RECOVERY_EMAIL_DRY_RUN=1` or missing `RESEND_API_KEY` → logs intent but skips Resend call. Coupon still issued, `recoveryStep` advanced.

**Discount Stacking Rationale**:

Coupon discount is additional % (not absolute) because:
- Product prices are pre-discounted (10% welcome off by default)
- Coupon adds on top (10% → 20% total)
- Coupon clamped to 80% before stacking, total capped at 95% to ensure non-zero order
- Server-side only; client cannot forge higher discounts
