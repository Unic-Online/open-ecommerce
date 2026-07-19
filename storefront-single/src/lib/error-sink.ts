/**
 * Backend error sink — structured JSON to stderr, optional HTTP forwarder.
 *
 * Invariants:
 *   - Always emits one JSON line per error to stderr — Vercel ingests and the line is queryable.
 *   - PII fields (`email`, `phone`) are masked before serialization; string fields are length-capped.
 *   - Optional HTTP sink (`ERROR_SINK_URL` + `ERROR_SINK_TOKEN`) is fire-and-forget — never blocks the caller.
 *   - Never throws — a logger that itself crashes makes incident response worse.
 * Side effects: writes to `process.stderr`; optionally POSTs to `ERROR_SINK_URL`.
 * Caller contract: use `captureError(err, { orderId, ... })` instead of `console.error` in any money-touching path.
 */

import { serverEnv } from '@/env';

export type ErrorContext = Record<string, unknown>;

export interface CaptureOptions {
  /** Tag for grouping (e.g. 'revolut_webhook', 'create_order'). Becomes top-level `tag`. */
  tag?: string;
  /** Level — defaults to 'error'. Use 'warning' for soft failures the operator should still see. */
  level?: 'error' | 'warning';
}

export function captureError(err: unknown, context: ErrorContext = {}, opts: CaptureOptions = {}): void {
  try {
    const errObj = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    const payload = {
      level: opts.level ?? 'error',
      tag: opts.tag,
      timestamp: new Date().toISOString(),
      name: errObj.name,
      message: errObj.message,
      stack: errObj.stack,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      vercelRequestId: process.env.VERCEL_REQUEST_ID,
      ...scrubPII(context),
    };
    process.stderr.write(JSON.stringify(payload) + '\n');

    const sinkUrl = serverEnv.ERROR_SINK_URL;
    if (sinkUrl) {
      const token = serverEnv.ERROR_SINK_TOKEN;
      // Fire-and-forget — incident path can't afford to wait on a third-party log host.
      fetch(sinkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {
    // Never let logging fail the request.
  }
}

function scrubPII(ctx: ErrorContext): ErrorContext {
  const out: ErrorContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v === undefined || v === null) continue;
    if (k === 'email' && typeof v === 'string') out[k] = maskEmail(v);
    else if (k === 'phone' && typeof v === 'string') out[k] = '***';
    else if (typeof v === 'string') out[k] = v.length > 500 ? v.slice(0, 500) + '…' : v;
    else if (v instanceof Error) out[k] = { name: v.name, message: v.message, stack: v.stack };
    else out[k] = v;
  }
  return out;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const localKept = local.length <= 2 ? local : local.slice(0, 2);
  return `${localKept}***@${domain}`;
}
