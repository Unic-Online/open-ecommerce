/**
 * HMAC-signed recovery token used in the recovery-email URLs.
 *
 * Invariants:
 *   - Token format: `<base64url(payload)>.<base64url(hmac-sha256(payload))>`. Payload = `{ cartId, exp }`.
 *   - Constant-time signature compare via `crypto.timingSafeEqual` over equal-length buffers.
 *   - Default TTL is 7 days; `exp` is checked against `Date.now()` after signature verification.
 *   - Rotating `CART_RECOVERY_HMAC_SECRET` invalidates ALL outstanding recovery URLs AND admin sessions (shared secret).
 *   - Payload contains no PII — cartId is UUIDv4 and unguessable on its own.
 * Side effects: none (pure crypto).
 * Caller contract: never accept a recovery token whose verifier returns `valid: false` — the failure reason is informational only.
 */
import crypto from 'crypto';
import { serverEnv } from '@/env';

interface TokenPayload {
  cartId: string;
  exp: number; // epoch ms
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4;
  const padded = pad ? input + '='.repeat(4 - pad) : input;
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function getSecret(): string {
  const s = serverEnv.CART_RECOVERY_HMAC_SECRET;
  if (!s) {
    throw new Error('CART_RECOVERY_HMAC_SECRET is not set');
  }
  return s;
}

// HMAC context-binding: prefix `kind` into the signed input so this token
// — which shares `CART_RECOVERY_HMAC_SECRET` with admin auth, customer
// account auth, and magic links — cannot be replayed as any of those.
// Each verifier checks its own kind prefix.
const KIND_RECOVERY = 'cart-recovery';

export function signRecoveryToken(cartId: string, expiresInDays = 7): string {
  const payload: TokenPayload = {
    cartId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const payloadJson = Buffer.from(JSON.stringify(payload), 'utf8');
  const payloadEncoded = base64UrlEncode(payloadJson);
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${KIND_RECOVERY}.${payloadEncoded}`)
    .digest();
  return `${payloadEncoded}.${base64UrlEncode(sig)}`;
}

export interface VerifyOk {
  valid: true;
  cartId: string;
  exp: number;
}
export interface VerifyFailure {
  valid: false;
  reason: 'malformed' | 'signature' | 'expired';
}

export function verifyRecoveryToken(token: string): VerifyOk | VerifyFailure {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadEncoded, sigEncoded] = parts;
  let expectedSig: Buffer;
  let providedSig: Buffer;
  try {
    expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(`${KIND_RECOVERY}.${payloadEncoded}`)
      .digest();
    providedSig = base64UrlDecode(sigEncoded);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    return { valid: false, reason: 'signature' };
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded).toString('utf8')) as TokenPayload;
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (typeof payload.cartId !== 'string' || typeof payload.exp !== 'number') {
    return { valid: false, reason: 'malformed' };
  }
  if (payload.exp < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, cartId: payload.cartId, exp: payload.exp };
}
