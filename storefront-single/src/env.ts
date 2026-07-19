/**
 * Single validated env layer for the whole app.
 *
 * This is the one place a template user looks to see — and configure — every
 * environment variable the storefront reads. Two sections:
 *
 *   - `serverEnv`  — server-only secrets/flags. Lazy, live getters: each access
 *                    re-reads `process.env` so tests that mutate the process
 *                    environment mid-run (auth/secret rotation specs) still see
 *                    the current value. Zod only coerces/validates shape; it
 *                    never snapshots a value across calls.
 *   - `clientEnv`  — `NEXT_PUBLIC_*` vars. MUST be a plain object literal whose
 *                    fields each reference their own literal
 *                    `process.env.<NEXT_PUBLIC name>` expression, because Next.js
 *                    statically inlines those literals into the browser bundle
 *                    at build time. Dynamic / computed access does NOT reach the
 *                    client, so do not refactor these into a loop or a Proxy.
 *
 * Production-boot contract: `assertProdEnvOrThrow()` (called once from
 * instrumentation.ts) hard-fails cold start when a required var is missing —
 * but ONLY in a production Vercel runtime. Dev / preview / test pass through so
 * contributors can run without a full secret set.
 *
 * Optional integrations (Meta Pixel/CAPI knobs, GA/GTM, Faro, abandoned-cart
 * flags, Revolut public key, error sink) are `.optional()` — when absent the
 * corresponding feature silently disables, exactly as before this layer existed.
 *
 * Exceptions intentionally NOT routed through here (read `process.env` directly
 * where cleaner): `NODE_ENV` and the Vercel platform vars (`VERCEL_ENV`,
 * `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_REQUEST_ID`,
 * `NEXT_RUNTIME`).
 */
import { z } from 'zod';

// ─── Helper schemas ─────────────────────────────────────────────────────────

// Optional flag string: present-or-undefined passthrough. We zod-parse the
// `'1'`-style toggles so the layer owns a single coercion point even though the
// shape is permissive; missing required vars surface with a named error either
// at their lazy call site (mongodb/resend/revolut) or at boot via
// `assertProdEnvOrThrow()`.
const onFlag = z.string().optional();

// ─── Server env ─────────────────────────────────────────────────────────────

/**
 * Server-only environment. Each property is a live getter — it reads
 * `process.env` at access time. Required vars (Mongo/Revolut/Resend/secrets)
 * are exposed as `string | undefined` here and validated either at the call
 * site (the existing lazy `throw` in mongodb/resend/revolut) or at cold start
 * via `assertProdEnvOrThrow()`; this keeps build-time `Collecting page data`
 * from crashing without secrets.
 */
export const serverEnv = {
  // ── REQUIRED FOR CHECKOUT (validated at boot in prod) ──
  /** MongoDB connection string. Atlas → Connect → Drivers. */
  get MONGODB_URI(): string | undefined {
    return process.env.MONGODB_URI;
  },
  /** Mongo database name. Defaults applied by callers (site.config / e2e override). */
  get MONGODB_DB_NAME(): string | undefined {
    return process.env.MONGODB_DB_NAME;
  },
  /** Resend API key. resend.com → API Keys. */
  get RESEND_API_KEY(): string | undefined {
    return process.env.RESEND_API_KEY;
  },
  /** Revolut Merchant secret key (`sk_...`). Revolut Business → Merchant API → API keys. */
  get REVOLUT_SECRET_KEY(): string | undefined {
    return process.env.REVOLUT_SECRET_KEY;
  },
  /** HMAC secret verifying Revolut webhook signatures. Returned by `pnpm revolut:webhook create`. */
  get REVOLUT_WEBHOOK_SIGNING_SECRET(): string | undefined {
    return process.env.REVOLUT_WEBHOOK_SIGNING_SECRET;
  },
  /** Admin dashboard password. Set to any strong value you choose. */
  get ADMIN_PASSWORD(): string | undefined {
    return process.env.ADMIN_PASSWORD;
  },
  /** HMAC secret for admin/account/recovery tokens. Generate with `openssl rand -hex 32`. */
  get CART_RECOVERY_HMAC_SECRET(): string | undefined {
    return process.env.CART_RECOVERY_HMAC_SECRET;
  },
  /** Bearer secret the Vercel cron sends to gate the recovery/replay cron routes. */
  get CART_RECOVERY_CRON_SECRET(): string | undefined {
    return process.env.CART_RECOVERY_CRON_SECRET;
  },
  /** Meta Conversions API access token. Events Manager → Settings → Conversions API. */
  get META_CAPI_ACCESS_TOKEN(): string | undefined {
    return process.env.META_CAPI_ACCESS_TOKEN;
  },

  // ── OPTIONAL: server-side mode / flags ──
  /** Revolut API mode — `sandbox` routes to the sandbox host; anything else = live. */
  get REVOLUT_API_MODE(): string | undefined {
    return process.env.REVOLUT_API_MODE;
  },
  /** `'1'` short-circuits every outbound email (Playwright + manual debugging). */
  get EMAIL_DRY_RUN(): string | undefined {
    return onFlag.parse(process.env.EMAIL_DRY_RUN);
  },
  /** Meta CAPI test-events tag — forwarded as `test_event_code` when set. */
  get META_CAPI_TEST_EVENT_CODE(): string | undefined {
    return process.env.META_CAPI_TEST_EVENT_CODE;
  },
  /** `'1'` disables server-side Purchase CAPI (the cron + webhook senders no-op). */
  get META_CAPI_DISABLE_SERVER_PURCHASE(): string | undefined {
    return onFlag.parse(process.env.META_CAPI_DISABLE_SERVER_PURCHASE);
  },

  // ── OPTIONAL: error sink ──
  /** Optional HTTP error-sink URL; absent = stderr-only logging. */
  get ERROR_SINK_URL(): string | undefined {
    return process.env.ERROR_SINK_URL;
  },
  /** Bearer token for the error sink, sent only when ERROR_SINK_URL is set. */
  get ERROR_SINK_TOKEN(): string | undefined {
    return process.env.ERROR_SINK_TOKEN;
  },

  // ── OPTIONAL: abandoned-cart server flags ──
  /** `'1'`/`'0'` force the abandoned-cart dry-run mode; unset = derived from MONGODB_URI presence. */
  get ABANDONED_CART_DRY_RUN(): string | undefined {
    return process.env.ABANDONED_CART_DRY_RUN;
  },
  /** `'0'` disables recovery-email sends (state still advances). */
  get ABANDONED_CART_RECOVERY_EMAIL_ENABLED(): string | undefined {
    return process.env.ABANDONED_CART_RECOVERY_EMAIL_ENABLED;
  },
  /** `'1'` logs recovery-email intent without calling Resend. */
  get RECOVERY_EMAIL_DRY_RUN(): string | undefined {
    return onFlag.parse(process.env.RECOVERY_EMAIL_DRY_RUN);
  },

  // ── OPTIONAL: test-endpoint gate ──
  /** `'1'` opens the `/api/test-only/*` debug endpoints (Playwright webServer). */
  get E2E_DEBUG_ENDPOINTS(): string | undefined {
    return onFlag.parse(process.env.E2E_DEBUG_ENDPOINTS);
  },
} as const;

// ─── Client env ─────────────────────────────────────────────────────────────

/**
 * Client-exposed environment (`NEXT_PUBLIC_*`).
 *
 * CRITICAL: every field reads its OWN literal `process.env.<NEXT_PUBLIC name>`
 * expression so Next.js can inline the value into the browser bundle at build
 * time. Do NOT convert this to a loop, Proxy, or computed key — dynamic access
 * resolves to `undefined` in the browser. All fields are optional; an absent
 * value disables the corresponding integration exactly as before.
 */
export const clientEnv = {
  /** Meta (Facebook) Pixel ID — used by both the browser Pixel and server CAPI. */
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  /** Google Tag Manager container ID; absent = GTM/GA not injected. */
  NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
  /** GA4 measurement ID (e.g. G-XXXXXXXXXX); absent = gtag.js not loaded. */
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  /** Google Ads conversion-tracking ID (e.g. AW-XXXXXXXXXX); absent = no Ads tag configured. */
  NEXT_PUBLIC_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  /** Grafana Faro collector URL; absent = browser observability stays off. */
  NEXT_PUBLIC_FARO_URL: process.env.NEXT_PUBLIC_FARO_URL,
  /** Optional Faro app-name override. */
  NEXT_PUBLIC_FARO_APP_NAME: process.env.NEXT_PUBLIC_FARO_APP_NAME,
  /** Revolut public key (`pk_...`) for the browser SDK; absent = widgets show "not configured". */
  NEXT_PUBLIC_REVOLUT_PUBLIC_KEY: process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY,
  /** Revolut SDK mode (`sandbox`/`live`) — keep in sync with REVOLUT_API_MODE. */
  NEXT_PUBLIC_REVOLUT_API_MODE: process.env.NEXT_PUBLIC_REVOLUT_API_MODE,
  /** Abandoned-cart master toggle (`'1'` enables the plugin). */
  NEXT_PUBLIC_ABANDONED_CART_ENABLED: process.env.NEXT_PUBLIC_ABANDONED_CART_ENABLED,
  /** Abandoned-cart exit-intent popup toggle. */
  NEXT_PUBLIC_ABANDONED_CART_EXIT_INTENT: process.env.NEXT_PUBLIC_ABANDONED_CART_EXIT_INTENT,
  /** Abandoned-cart server-side cart-sync toggle. */
  NEXT_PUBLIC_ABANDONED_CART_CART_SYNC: process.env.NEXT_PUBLIC_ABANDONED_CART_CART_SYNC,
  /** Abandoned-cart checkout-draft persistence toggle. */
  NEXT_PUBLIC_ABANDONED_CART_CHECKOUT_DRAFT: process.env.NEXT_PUBLIC_ABANDONED_CART_CHECKOUT_DRAFT,
  /** Abandoned-cart QA test-mode (collapses cooldowns/thresholds). */
  NEXT_PUBLIC_ABANDONED_CART_TEST_MODE: process.env.NEXT_PUBLIC_ABANDONED_CART_TEST_MODE,
  /** Exit-intent mobile back-button intercept experiment (`'1'` enables). */
  NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT: process.env.NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT,
} as const;

// ─── Production-boot preflight ──────────────────────────────────────────────

/**
 * Source of truth for "must be set before live traffic". Validated at cold
 * start in production only (see `assertProdEnvOrThrow`). `NEXT_PUBLIC_*` vars
 * live in `clientEnv`; `NEXT_PUBLIC_META_PIXEL_ID` is required here because a
 * missing Pixel ID silently no-ops every Purchase event (browser + CAPI replay).
 */
export const REQUIRED_PROD_ENV = [
  'MONGODB_URI',
  'REVOLUT_SECRET_KEY',
  'REVOLUT_WEBHOOK_SIGNING_SECRET',
  'RESEND_API_KEY',
  'CART_RECOVERY_HMAC_SECRET',
  'CART_RECOVERY_CRON_SECRET',
  'ADMIN_PASSWORD',
  // Meta Pixel + CAPI: missing either silently no-ops every Purchase event,
  // including via the cron replay. Fail boot instead of dropping conversions.
  'NEXT_PUBLIC_META_PIXEL_ID',
  'META_CAPI_ACCESS_TOKEN',
] as const;

export interface ValidateResult {
  ok: boolean;
  missing: string[];
}

export function validateProdEnv(): ValidateResult {
  const missing = REQUIRED_PROD_ENV.filter((k) => {
    const v = process.env[k];
    return !v || v.trim() === '';
  });
  return { ok: missing.length === 0, missing };
}

export function isProductionRuntime(): boolean {
  // Vercel sets VERCEL_ENV to 'production' | 'preview' | 'development'.
  // Treat anything else as not-prod so contributors can `pnpm dev` without secrets.
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return false;
}

/**
 * Cold-start guard. Throws synchronously if any required env var is missing in
 * prod — surfaces in Vercel build/runtime logs and fails the function instance
 * rather than silently 500ing on the first customer request.
 *
 * No-ops in preview / dev / test.
 */
export function assertProdEnvOrThrow(): void {
  if (!isProductionRuntime()) return;
  const { ok, missing } = validateProdEnv();
  if (!ok) {
    throw new Error(
      `[boot] Missing required production env vars: ${missing.join(', ')}. ` +
        `Set them in the Vercel dashboard and redeploy.`,
    );
  }
}

/**
 * Test seam. `serverEnv` reads `process.env` live, so there is no value cache
 * to clear today — this is a forward-compatible no-op hook so tests can call it
 * after mutating `process.env` without depending on the internal caching model.
 */
export function resetEnvCacheForTests(): void {
  // No-op: serverEnv getters read process.env on every access. Kept as a stable
  // hook in case a future field memoizes a parsed value.
}
