'use client';

import { abandonedCartConfig } from './config';
import ExitIntentPopup from './client/ExitIntentPopup';
import CartSync from './client/CartSync';

/**
 * Single mount point for the abandoned-cart plugin. Renders only the
 * sub-features that are toggled on via NEXT_PUBLIC_* env vars.
 *
 * Phases 2-6 (cart sync, recovery email cron, admin dashboard) plug in
 * here as additional conditional children. The mount itself is one
 * line in src/app/layout.tsx.
 */
export function AbandonedCartPlugin() {
  if (!abandonedCartConfig.enabled) return null;

  return (
    <>
      {abandonedCartConfig.exitIntent && <ExitIntentPopup />}
      {abandonedCartConfig.cartSync && <CartSync />}
      {/* Phase 4: <CheckoutFieldDraft /> */}
    </>
  );
}
