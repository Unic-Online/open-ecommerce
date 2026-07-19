# Bringing your own payment provider

Both templates ship with two payment methods: **cash on delivery** (works
with zero provider configuration — the reference proof that checkout is not
coupled to any PSP) and **card via Revolut** (the reference provider
implementation). The provider integration is deliberately confined to a
small, documented surface so you can replace Revolut with Stripe, PayPal,
Adyen, Mollie, or anything else without touching pricing, orders, emails,
analytics, or the admin dashboard.

## The provider surface (4 files)

Everything provider-specific lives here (paths from `storefront-single`;
`storefront-i18n` is identical apart from the `[locale]` segment):

| File | Responsibility |
|---|---|
| `src/lib/revolut.ts` | API client + webhook signature verifier. Create/retrieve/cancel provider orders; HMAC verification with a constant-time compare and a 5-minute replay window. |
| `src/app/api/payments/revolut/create-order/route.ts` | Server route the checkout calls. Zod-validates the request, resolves the cart against the catalog, **recomputes totals server-side**, persists the local order (`pending_payment`) *before* any provider call, then creates the provider order and stores `payment.providerOrderId`. Also cancels stale provider sessions to close multi-tab races. |
| `src/app/api/webhooks/revolut/route.ts` | Signature-verified webhook. Maps provider state → order status through the status machine, re-fetches the order from the provider as defense in depth, sends idempotent confirmation emails (claim/release markers), fires the server-side Meta CAPI purchase, completes the abandoned-cart record, and files unknown-order events into a webhook inbox. |
| `src/components/RevolutPaymentWidgets.tsx` | Client widget. Mounts the provider's browser SDK, prepares/destroys the payment session whenever cart or shipping data changes (so the provider order always matches checkout state), and handles wallet redirect returns. |

Supporting wiring you extend rather than rewrite:

- `src/site.config.ts` — the market's `checkout.paymentMethods: ['cod', 'card']` drives which methods the checkout UI offers.
- `src/env.ts` + `.env.example` — provider credentials go through the validated env layer (see the "add an env var" rule in `AGENTS.md`).
- `src/lib/orders/status-machine.ts` — order status transitions (`pending_payment → paid/failed/cancelled`, terminal states protected from late webhooks). Your webhook maps provider states onto these; the machine itself doesn't change.
- `e2e/fixtures/api-mocks.ts` — the e2e suite mocks the provider boundary; extend it for yours.

## What you inherit for free

Because the order is persisted before the provider call and all money math
is server-side, a new provider integration automatically gets: server-trust
pricing (client prices are never charged), idempotent order emails, coupon
redemption atomicity, abandoned-cart completion, Meta CAPI purchase with
dedup + replay cron, admin visibility, and the full e2e checkout suite.

## Porting recipe (Stripe example)

1. `src/lib/stripe.ts` — thin client: create PaymentIntent, retrieve status,
   verify webhook signatures (`stripe.webhooks.constructEvent`). Mirror the
   exports of `revolut.ts`.
2. `src/app/api/payments/stripe/create-order/route.ts` — copy the Revolut
   route; swap the provider-order call for a PaymentIntent (`amount` from the
   server-recomputed total, `metadata.orderId` for webhook correlation).
3. `src/app/api/webhooks/stripe/route.ts` — copy the Revolut webhook; map
   `payment_intent.succeeded/…failed/…canceled` onto the status machine.
4. `src/components/StripePaymentWidgets.tsx` — mount Stripe Elements; keep
   the prepare/destroy-on-change lifecycle.
5. Wire up: env vars via `src/env.ts` + `.env.example`, point the checkout at
   your widget, extend `e2e/fixtures/api-mocks.ts`, run
   `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.

The fastest path is handing this file to an AI agent working in the repo
(each template ships an `AGENTS.md` operating manual):

> *"Add Stripe as a card payment provider following PAYMENTS.md — mirror the
> Revolut reference implementation, keep the order-doc contract, and finish
> with the full test suite green."*
