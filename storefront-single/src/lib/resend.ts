import { Resend } from 'resend';
import { serverEnv } from '@/env';
import { getStageMarker } from './env-stage';
import { isTestEndpointEnabled } from './test-endpoint-gate';

let cached: Resend | undefined;

/** Lazy Resend client — defers the env check until the first call so module
 *  evaluation (build-time `Collecting page data`) doesn't crash without secrets. */
export function getResend(): Resend {
  if (!cached) {
    const key = serverEnv.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not set');
    cached = new Resend(key);
  }
  return cached;
}

type SendArgs = Parameters<Resend['emails']['send']>[0];

// One-shot test seam. Set by the gated debug endpoint
// `/api/_test/force-email-fail-next` — when true, the very next sendEmail()
// call returns a Resend-shaped failure and resets the flag. Lets e2e specs
// exercise the "email infrastructure failed but the fulfillment write must
// still commit" branch without running through real Resend errors.
//
// Module-scoped state lives in the dev-server process; the endpoint that
// flips it (and this consumer) are both gated by `isTestEndpointEnabled()`,
// so there is no production code path that can set the flag.
let _forceFailNext = false;

/** Internal API — only callable from the gated `/api/_test/...` endpoint.
 *  Throws in production so an accidental call surfaces immediately. */
export function _testSetForceEmailFailNext(): void {
  if (!isTestEndpointEnabled()) {
    throw new Error('_testSetForceEmailFailNext invoked with test endpoints disabled');
  }
  _forceFailNext = true;
}

function consumeForceFail(): boolean {
  if (!_forceFailNext) return false;
  _forceFailNext = false;
  return true;
}

/** Wraps `resend.emails.send` to auto-tag staging/preview deploys.
 *
 *  Side effects: outbound HTTPS to api.resend.com.
 *
 *  Caller contract:
 *    - Use this everywhere instead of `getResend().emails.send(...)` so all
 *      outbound mail goes through the same staging-marker chokepoint.
 *    - Returns the underlying Resend response unchanged. */
export function sendEmail(args: SendArgs): ReturnType<Resend['emails']['send']> {
  // Test failure injection takes precedence over dry-run so e2e can assert
  // the "Resend down" branch even when EMAIL_DRY_RUN=1 is set globally.
  // We throw (rather than resolving with `error`) because that matches the
  // real-world infrastructure-failure shape that callers expect: network
  // errors, missing RESEND_API_KEY, and Resend SDK exceptions all bubble
  // as throws, and consumers (e.g. fulfillment route) wrap sendEmail in
  // try/catch on that assumption.
  if (consumeForceFail()) {
    return Promise.reject(
      new Error('forced sendEmail failure (test-only seam)'),
    ) as ReturnType<Resend['emails']['send']>;
  }

  // E2E / sandbox short-circuit: short-circuit before any Resend call so the
  // suite can exercise Revolut sandbox without burning Resend quota or
  // delivering mail to real recipients. Returns the same shape Resend would.
  if (serverEnv.EMAIL_DRY_RUN === '1') {
    const subject = typeof args.subject === 'string' ? args.subject : '<non-string subject>';
    const to = Array.isArray(args.to) ? args.to.join(',') : args.to;
    console.log(`[sendEmail DRY_RUN] would send "${subject}" to ${to}`);
    return Promise.resolve({
      data: { id: `dry-run-${Date.now().toString(36)}` },
      error: null,
    }) as ReturnType<Resend['emails']['send']>;
  }

  const marker = getStageMarker();
  if (!marker) return getResend().emails.send(args);

  const subject = typeof args.subject === 'string' ? `${marker.subjectPrefix}${args.subject}` : args.subject;
  const html = typeof args.html === 'string' ? injectBanner(args.html, marker.htmlBanner) : args.html;
  return getResend().emails.send({ ...args, subject, html } as SendArgs);
}

function injectBanner(html: string, banner: string): string {
  // Insert banner immediately after the opening <body...> tag so it shows
  // above all email chrome regardless of template; fall back to prepending.
  const m = html.match(/<body[^>]*>/i);
  if (m && typeof m.index === 'number') {
    const end = m.index + m[0].length;
    return html.slice(0, end) + banner + html.slice(end);
  }
  return banner + html;
}
