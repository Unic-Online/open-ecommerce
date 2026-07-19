/**
 * POST /api/_test/force-email-fail-next  (test-only)
 *
 * Arms a one-shot flag in the dev/staging server process so the very next
 * `sendEmail()` invocation returns a Resend-shaped failure. Lets e2e
 * specs prove the "Resend down" branch (e.g. "fulfillment write must
 * commit even if the shipment email fails") deterministically.
 *
 * Gate: `isTestEndpointEnabled()`. In production the route returns 404 so
 * the existence of the seam is not even discoverable.
 */
import { NextResponse } from 'next/server';
import { _testSetForceEmailFailNext } from '@/lib/resend';
import { isTestEndpointEnabled } from '@/lib/test-endpoint-gate';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!isTestEndpointEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  _testSetForceEmailFailNext();
  return NextResponse.json({ ok: true });
}
