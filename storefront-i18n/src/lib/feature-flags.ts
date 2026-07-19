/**
 * Feature-flag gating helpers.
 *
 * Re-exports the `features` config and provides the two seams every gated
 * route uses: a plain 404 `Response` for API route handlers, and a `notFound()`
 * pass-through for RSC pages/layouts. Gating lives at the route/layout level —
 * never deep inside components — so a disabled feature is fully inert (the
 * route 404s before any feature code runs).
 *
 * Side effects: none.
 */
import { notFound } from 'next/navigation';
import { features, type FeaturesConfig } from '@/site.config';

export { features };
export type { FeaturesConfig };

/** A bare 404 `Response` for API route handlers behind a disabled flag. */
export function notFoundResponse(): Response {
  return new Response('Not Found', { status: 404 });
}

/** Calls Next's `notFound()` (throws) when `enabled` is false; for pages/layouts. */
export function notFoundUnless(enabled: boolean): void {
  if (!enabled) notFound();
}
