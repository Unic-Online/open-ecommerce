// Client-safe feature flags for the abandoned-cart plugin. NEXT_PUBLIC_*
// vars are inlined at build time, so this object is safe in browser bundles.
//
// Toggling NEXT_PUBLIC_ABANDONED_CART_ENABLED off makes <AbandonedCartPlugin />
// render nothing — the plugin becomes a no-op without a redeploy of any
// other code.

import { clientEnv, serverEnv } from '@/env';

export const abandonedCartConfig = {
  enabled: clientEnv.NEXT_PUBLIC_ABANDONED_CART_ENABLED === '1',
  exitIntent: clientEnv.NEXT_PUBLIC_ABANDONED_CART_EXIT_INTENT === '1',
  // Experiment: intercept the first mobile back press with the exit-intent
  // popup (costs the user one extra back press — keep measurable & reversible).
  exitIntentBackIntercept:
    clientEnv.NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT === '1',
  cartSync: clientEnv.NEXT_PUBLIC_ABANDONED_CART_CART_SYNC === '1',
  checkoutDraft: clientEnv.NEXT_PUBLIC_ABANDONED_CART_CHECKOUT_DRAFT === '1',
  testMode: clientEnv.NEXT_PUBLIC_ABANDONED_CART_TEST_MODE === '1',
} as const;

// Cooldown before the same browser sees the exit-intent popup again. Matches
// CartBounty's default of 1h. testMode=true bypasses the cooldown entirely
// so QA doesn't have to wait.
export const EXIT_INTENT_COOLDOWN_MS = abandonedCartConfig.testMode
  ? 0
  : 60 * 60 * 1000;

// Skip the popup on these path prefixes. Showing a discount popup while the
// user is mid-checkout (or on the order-confirmation page) is hostile.
export const EXIT_INTENT_SKIP_PATHS = ['/checkout', '/cart', '/order-confirmation'];

/**
 * Server-only — the plugin's persistence + email layers should be a no-op
 * when MongoDB isn't configured (dev/test environments without a DB) or
 * when explicitly disabled. Routes that detect this respond with
 * { dryRun: true } and skip the DB call.
 *
 * Production: explicitly set ABANDONED_CART_DRY_RUN=0 (or leave unset and
 * provide MONGODB_URI). The common path is "DB present → real writes."
 */
export function isAbandonedCartDryRun(): boolean {
  if (serverEnv.ABANDONED_CART_DRY_RUN === '1') return true;
  if (serverEnv.ABANDONED_CART_DRY_RUN === '0') return false;
  return !serverEnv.MONGODB_URI;
}
