/**
 * Gate for test-only debug endpoints under `/api/test-only/...`.
 *
 * Two independent conditions enable the gate:
 *   1. `NODE_ENV === 'development'` — dev server (`pnpm dev`).
 *   2. `E2E_DEBUG_ENDPOINTS === '1'` — explicit opt-in, used by Playwright's
 *      webServer config. Safe to set on a Vercel preview if e2e needs to
 *      run against it; never set on the production environment.
 *
 * Anywhere we run with `NODE_ENV === 'production'` AND `E2E_DEBUG_ENDPOINTS`
 * unset, the gate is closed and the endpoints 404. Belt-and-suspenders so a
 * misconfiguration in one knob can't open the gate alone.
 */
import { serverEnv } from '@/env';

export function isTestEndpointEnabled(): boolean {
  if (serverEnv.E2E_DEBUG_ENDPOINTS === '1') return true;
  return process.env.NODE_ENV === 'development';
}
