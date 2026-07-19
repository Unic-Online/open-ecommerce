/**
 * Revolut Merchant API client + webhook signature verifier.
 *
 * Invariants:
 *   - API_VERSION pin (`2026-03-12`) MUST match `docs/revolut-merchant-2026-03-12.yaml`; bumping requires a docs sync.
 *   - Webhook HMAC is signature-version `v1`: payload = `v1.<timestamp>.<rawBody>`, signed with `signingSecret`.
 *   - Replay window is 5 min (REPLAY_TOLERANCE_MS); timestamps outside reject regardless of signature match.
 *   - Constant-time compare via `crypto.timingSafeEqual` over equal-length buffers — never `===` the digest.
 * Side effects: outbound HTTPS to merchant.revolut.com (or sandbox-merchant.revolut.com when REVOLUT_API_MODE=sandbox).
 * Caller contract: pass the raw request body verbatim to `verifyRevolutWebhookSignature` — any reserialization breaks the HMAC.
 */
import crypto from 'crypto';
import { serverEnv } from '@/env';

const PRODUCTION_BASE = 'https://merchant.revolut.com';
const SANDBOX_BASE = 'https://sandbox-merchant.revolut.com';
const API_VERSION = '2026-03-12';
const SIGNATURE_VERSION = 'v1';
const REPLAY_TOLERANCE_MS = 5 * 60 * 1000;

export type RevolutOrderState =
  | 'pending'
  | 'processing'
  | 'authorised'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type RevolutWebhookEvent =
  | 'ORDER_COMPLETED'
  | 'ORDER_AUTHORISED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FAILED'
  | 'ORDER_PAYMENT_AUTHENTICATED'
  | 'ORDER_PAYMENT_AUTHENTICATION_CHALLENGED'
  | 'ORDER_PAYMENT_DECLINED'
  | 'ORDER_PAYMENT_FAILED'
  | (string & {});

export interface RevolutOrder {
  id: string;
  token: string;
  type: string;
  state: RevolutOrderState;
  created_at: string;
  updated_at: string;
  description?: string;
  capture_mode?: 'automatic' | 'manual';
  amount: number;
  outstanding_amount?: number;
  refunded_amount?: number;
  currency: string;
  customer?: { id?: string; email?: string; phone?: string; full_name?: string };
  checkout_url?: string;
  redirect_url?: string;
  merchant_order_data?: { reference?: string; url?: string };
  metadata?: Record<string, string>;
}

export interface RevolutWebhookPayload {
  event: RevolutWebhookEvent;
  order_id?: string;
  merchant_order_ext_ref?: string;
  subscription_id?: string;
  payout_id?: string;
  dispute_id?: string;
}

export interface CreateRevolutOrderInput {
  amountMinor: number;
  currency: string;
  description: string;
  merchantOrderRef: string;
  redirectUrl: string;
  customer: { email: string; full_name?: string; phone?: string };
  metadata?: Record<string, string>;
  // When set, sent as the `Idempotency-Key` header. Revolut returns the
  // existing order for repeat keys, so a retry of /api/payments/revolut/create-order
  // with the same key does NOT create a duplicate session at the provider.
  // Caller convention: pass our internal orderId (stable per cartId+email).
  idempotencyKey?: string;
}

function apiBase(): string {
  return serverEnv.REVOLUT_API_MODE === 'sandbox' ? SANDBOX_BASE : PRODUCTION_BASE;
}

function secretKey(): string {
  const k = serverEnv.REVOLUT_SECRET_KEY;
  if (!k) throw new Error('REVOLUT_SECRET_KEY not set');
  return k;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${secretKey()}`,
    'Revolut-Api-Version': API_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function parseRevolutResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const msg = (body && typeof body === 'object' && 'message' in body
      ? String((body as { message: unknown }).message)
      : `HTTP ${res.status}`);
    const err = new Error(`Revolut API error: ${msg}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function createRevolutOrder(input: CreateRevolutOrderInput): Promise<RevolutOrder> {
  const headers = authHeaders();
  if (input.idempotencyKey) {
    headers['Idempotency-Key'] = input.idempotencyKey;
  }
  const res = await fetch(`${apiBase()}/api/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      description: input.description,
      customer: input.customer,
      merchant_order_data: { reference: input.merchantOrderRef },
      redirect_url: input.redirectUrl,
      capture_mode: 'automatic',
      metadata: input.metadata,
    }),
  });
  return parseRevolutResponse(res) as Promise<RevolutOrder>;
}

export async function retrieveRevolutOrder(orderId: string): Promise<RevolutOrder> {
  const res = await fetch(`${apiBase()}/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return parseRevolutResponse(res) as Promise<RevolutOrder>;
}

// Cancels an uncaptured Revolut order. Used when the customer switches a
// card-prepared session to cod (or to a fresh card session), so the
// abandoned provider order can never flip to paid behind our back.
// Tolerates already-terminal orders: 400 with code 'invalid_state' and 404
// resolve to a no-op rather than throwing — the caller's intent ("make sure
// this old session can't pay") is satisfied either way.
export async function cancelRevolutOrder(orderId: string): Promise<void> {
  const res = await fetch(
    `${apiBase()}/api/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: 'POST', headers: authHeaders() },
  );
  if (res.ok) return;
  if (res.status === 404) return;
  if (res.status === 400) return;
  await parseRevolutResponse(res);
}

export interface VerifyWebhookInput {
  rawBody: string;
  signatureHeader: string | null | undefined;
  timestampHeader: string | null | undefined;
  signingSecret: string;
  now?: number;
}

export type VerifyWebhookResult = { ok: true } | { ok: false; reason: string };

export function verifyRevolutWebhookSignature(input: VerifyWebhookInput): VerifyWebhookResult {
  const { rawBody, signatureHeader, timestampHeader, signingSecret } = input;

  if (!signingSecret) return { ok: false, reason: 'missing signing secret' };
  if (!signatureHeader) return { ok: false, reason: 'missing signature header' };
  if (!timestampHeader) return { ok: false, reason: 'missing timestamp header' };

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' };

  const now = input.now ?? Date.now();
  if (Math.abs(now - ts) > REPLAY_TOLERANCE_MS) return { ok: false, reason: 'timestamp out of tolerance' };

  const payload = `${SIGNATURE_VERSION}.${ts}.${rawBody}`;
  const expectedHex = crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
  const expected = `${SIGNATURE_VERSION}=${expectedHex}`;
  const expectedBuf = Buffer.from(expected);

  const candidates = signatureHeader.split(',').map(s => s.trim()).filter(Boolean);
  for (const cand of candidates) {
    const candBuf = Buffer.from(cand);
    if (candBuf.length === expectedBuf.length && crypto.timingSafeEqual(candBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'signature mismatch' };
}
