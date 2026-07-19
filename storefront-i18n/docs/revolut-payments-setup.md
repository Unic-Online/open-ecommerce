# Revolut payments — setup & operations

This codebase integrates the **Revolut Merchant API v2** (`Revolut-Api-Version: 2026-03-12`) using the **Revolut Web SDK** for inline payment widgets. The full OpenAPI spec lives next to this file at [`revolut-merchant-2026-03-12.yaml`](./revolut-merchant-2026-03-12.yaml) and is the source of truth for any field/endpoint question.

## Architecture

```
checkout/page.tsx
├── shipping form (validates reactively)
├── <RevolutPaymentWidgets>  (client, mounts Revolut Web SDK)
│   ├── Revolut Pay button         ── mounts only after shipping is valid
│   ├── Apple Pay / Google Pay     ── auto-detected by browser
│   │                                 (paymentRequest mounts only if supported)
│   └── Embedded card flow         ── explicit "prepare card form" step
│                                     create-order happens on prepare,
│                                     then the iframe session is submitted
└── Ramburs button (POST /api/order)  ── existing cash-on-delivery path

checkout/page.tsx also persists the shipping form draft in `localStorage` and restores it when the shopper comes back to checkout. The draft is cleared only after a confirmed successful order.

Wallets call our `createOrder` callback when the shopper starts a wallet payment:
  POST /api/payments/revolut/create-order
        ├─ recompute price server-side from items
        ├─ Mongo save (status=pending_payment) — blocking, fail closed
        ├─ Revolut: POST /api/orders → { id, token (= publicId), checkout_url? }
        ├─ persist providerOrderId + providerPublicId for webhook/redirect resolution
        └─ return { orderId, publicId, checkoutUrl?, providerOrderId }
        SDK uses publicId to authenticate the payment session.

Card payment is a separate two-step flow:
1. user clicks the "prepare card form" button
2. client calls `POST /api/payments/revolut/create-order`, persists the local order, creates the Revolut order, and mounts the PCI iframe
3. user clicks "Pay" to submit that prepared iframe session

If shipping or cart data changes after the card session is prepared, the component destroys the card iframe, clears the prepared internal order reference, and forces a fresh prepare step so the provider order always matches the current checkout state.

On mobile, Revolut Pay also gets `mobileRedirectUrls` pointing to `/revolut-pay/return/[result]`. That return page resolves the `_rp_oid` public token back to the internal order and redirects to `/confirmare/{orderId}`, so app hand-off still lands on the correct order page even when widget callbacks do not fire.

After payment:
  ┌─ SDK fires onSuccess  ── client navigates to /confirmare/{orderId}
  └─ Revolut → POST /api/webhooks/revolut  (server-to-server, async)
        ├─ Verify HMAC-SHA256 signature  (Revolut-Signature header)
        ├─ Re-fetch order via GET /api/orders/{id}  (defense in depth)
        ├─ Update Mongo status (paid/failed/cancelled)
        └─ Send merchant + customer confirmation emails (idempotent via emailSentAt)
```

`merchant_order_data.reference` carries our short `orderId` so webhook events can match a local row by either `payment.providerOrderId` (Revolut UUID) or `merchant_order_ext_ref` (our 8-hex).

The Hosted Checkout URL (`checkoutUrl` in the create-order response) is no longer used by the UI — it stays in the response as a fallback link if you ever need to redirect a customer manually.

## Required environment variables

| Var | Where used | Notes |
|---|---|---|
| `REVOLUT_SECRET_KEY` | `lib/revolut.ts` | `sk_...` — server-only. Production keys hit live customers. |
| `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` | `components/RevolutPaymentWidgets.tsx` | `pk_...` — shipped to the browser; required for `RevolutCheckout.payments({ publicToken })`. Without it the widgets show a "not configured" message. |
| `REVOLUT_WEBHOOK_SIGNING_SECRET` | `app/api/webhooks/revolut/route.ts` | Generated when the webhook is created. The handler refuses every request until this is set (fail-safe). |
| `REVOLUT_API_MODE` | `lib/revolut.ts` | `live` (default) → `https://merchant.revolut.com`, `sandbox` → `https://sandbox-merchant.revolut.com`. Server-side flag. |
| `NEXT_PUBLIC_REVOLUT_API_MODE` | `components/RevolutPaymentWidgets.tsx` | Same `live`/`sandbox` value but for the browser SDK (`RevolutCheckout.payments({ mode })`). Keep in sync with `REVOLUT_API_MODE`. |

Local development uses `.env.local` at the project root. Vercel/production reads from the project's environment settings.

## One-time webhook setup

Merchant API webhooks are **API-only** — there is no webhook tab in the Revolut Business dashboard for them (the dashboard "Webhooks" UI is for the Business API, a different product). Use the helper script:

```bash
pnpm revolut:webhook create https://your-domain.example.com/api/webhooks/revolut
# prints: signing_secret = wsk_...
```

The script reads `REVOLUT_SECRET_KEY` and `REVOLUT_API_MODE` from `.env.local` and registers a webhook at the URL you pass (your deployed origin + `/api/webhooks/revolut`) with these events:

- `ORDER_COMPLETED`
- `ORDER_AUTHORISED`
- `ORDER_CANCELLED`
- `ORDER_FAILED`
- `ORDER_PAYMENT_DECLINED`

Other commands: `pnpm revolut:webhook list | delete <id> | rotate <id>`.

After creation, copy the `signing_secret` into `REVOLUT_WEBHOOK_SIGNING_SECRET` in **Vercel project env (Production)** and locally in `.env.local`. Redeploy.

### Apple Pay domain verification

Apple Pay buttons only render on Safari **after** your merchant domain is verified by Revolut. Until that's done, Safari users see only Revolut Pay + the explicit card flow; Google Pay & Revolut Pay work without this step.

To verify: Revolut Business dashboard → Merchant → **Apple Pay** → add your production domain (the one configured in `MARKETS[*].domain` in `src/site.config.ts`). Revolut handles the `/.well-known/apple-developer-merchantid-domain-association` file behind the scenes.

## Signature verification

`verifyRevolutWebhookSignature()` in `lib/revolut.ts` follows the format documented at [Revolut: Verify the payload signature](https://developer.revolut.com/docs/guides/accept-payments/tutorials/work-with-webhooks/verify-the-payload-signature):

```
payload_to_sign = "v1." + Revolut-Request-Timestamp + "." + raw_body
expected = "v1=" + hex(HMAC_SHA256(signing_secret, payload_to_sign))
```

The handler:
- Rejects requests older than 5 minutes (replay protection).
- Splits `Revolut-Signature` on commas; accepts if any candidate matches (rotation window).
- Compares with `crypto.timingSafeEqual`.

## Idempotency & race handling

- **Local order is saved BEFORE calling Revolut** (status `pending_payment`) and `saveOrder()` now throws on failure, so no provider order is created if Mongo persistence fails.
- **Confirmation emails fire exactly once** via a conditional `findOneAndUpdate` filtered on `emailSentAt: { $exists: false }`.
- **Confirmation page re-checks Revolut** when it sees `pending_payment` — the browser redirect from the SDK can beat the webhook by a few seconds.
- **Wallet and card flows use separate internal order refs** so a cancelled wallet attempt cannot redirect a later successful card payment to the wrong internal order.
- **Wallets require valid shipping before they mount** and use SDK-level validation as a second guard, so clicking Revolut Pay with an incomplete address no longer produces provider-side "invalid order" errors.
- **Wallet widgets re-mount only when the total changes** so displayed wallet amounts follow the latest cart total.
- **Card sessions are explicit and disposable**: no card order is created just because shipping became valid, and any cart/address change invalidates the prepared session before submission.
- **Checkout state survives back-navigation** because the shipping form is restored from local storage until a successful order clears it.

## Pricing trust boundary

The client never decides the amount that gets charged. `computeOrderTotal()` in `lib/pricing.ts` is the single source of truth:

- Subtotal = sum of `weight.price * quantity` from Zod-validated line items.
- Welcome discount applied server-side (`WELCOME_DISCOUNT` in `lib/pricing.ts`, currently 10%).
- Shipping derives from the active market's `shipping.standardCost` / `shipping.freeThreshold` in `src/site.config.ts` (the demo RO market uses 29 RON, free over 600 RON).
- `toMinorUnits(total, currency)` converts to the currency's minor units for the Revolut payload.

The wallet button labels follow the latest mounted amount, but the actual charge always equals whatever the server computes during `createOrder` from the latest cart contents — there's no path for a client-spoofed amount to reach the card processor.

## Testing the integration

- **Baseline**: `pnpm lint`, `pnpm test`, `pnpm exec tsc --noEmit`.
- **Unit / route**:
  - `src/__tests__/revolut.test.ts` — webhook signature verification
  - `src/__tests__/revolut-create-order-route.test.ts` — save-before-provider, checkoutUrl optionality, create-order failure modes
  - `src/__tests__/revolut-webhook-route.test.ts` — fallback lookup, invalid signatures, email idempotency
  - `src/__tests__/revolut-payment-widgets.test.tsx` — no card order on mount, explicit prepare step, session invalidation on checkout changes
  - `src/__tests__/pricing.test.ts` — totals
- **Smoke**: deploy → `/checkout`, fill shipping, click Apple/Google/Revolut Pay → verify in Vercel logs that `/api/payments/revolut/create-order` succeeded, MongoDB `orders` collection has the row with `status: pending_payment`. Close the wallet popup without paying.
- **Live**: complete a 1 RON purchase end-to-end → confirm `status: paid`, `payment.lastWebhookEvent: ORDER_COMPLETED`, `emailSentAt` set, both emails received → refund via Revolut Business → that order → Refund.
- **Sandbox**: `REVOLUT_API_MODE=sandbox` + `NEXT_PUBLIC_REVOLUT_API_MODE=sandbox` + sandbox `sk_...`/`pk_...` keys + sandbox webhook signing secret. Use Revolut's [test card numbers](https://developer.revolut.com/docs/guides/accept-payments/get-started/test-implementation/test-card-numbers) (e.g. `4929420573595709` for success, `4242424242424242` for 3DS challenge).

## Operational checklist before enabling card on production

- [ ] `REVOLUT_SECRET_KEY` set in Vercel production env
- [ ] `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` set in Vercel production env
- [ ] `REVOLUT_WEBHOOK_SIGNING_SECRET` set in Vercel production env (run `pnpm revolut:webhook create` to mint it)
- [ ] `REVOLUT_API_MODE=live` and `NEXT_PUBLIC_REVOLUT_API_MODE=live` (or both unset)
- [ ] Webhook registered (verify with `pnpm revolut:webhook list`) at `https://<your-domain>/api/webhooks/revolut`
- [ ] The market's `contact.fromEmail` sending domain (`MARKETS[*].contact.fromEmail` in `src/site.config.ts`) verified in Resend
- [ ] Merchant profile statement descriptor configured in Revolut Business
- [ ] Apple Pay production domain verified in Revolut Business (otherwise Safari shows only Revolut Pay + card)
- [ ] One full live round-trip completed: 1 RON purchase → status `paid` in Mongo → refunded via dashboard
