/**
 * HMAC-signed review-invite token — proves "this order actually contains this
 * product" for the CTA link in the post-delivery review-request email, so
 * the submitted review can be honestly labelled as a verified purchase.
 *
 * Invariants:
 *   - Token format identical to `recovery-token.ts`: `<base64url(payload)>.<base64url(hmac-sha256(payload))>`.
 *     Payload = `{ orderId, slug, exp }`.
 *   - Constant-time signature compare via `crypto.timingSafeEqual` over equal-length buffers.
 *   - Default TTL is 90 days — long enough that a customer opening the email
 *     weeks late still gets credited as a verified buyer.
 *   - Shares `CART_RECOVERY_HMAC_SECRET` with every other token class in this
 *     app; the `KIND_REVIEW` prefix stops a recovery/admin/magic-link token
 *     from being replayed here (and vice versa).
 *   - A verify failure (malformed, signature, expired) is never a hard error
 *     for the caller — see `/api/reviews`: it just downgrades the submission
 *     to `verifiedPurchase: false`, never rejects it.
 * Side effects: none (pure crypto).
 */
import crypto from 'crypto';
import { serverEnv } from '@/env';

interface TokenPayload {
  orderId: string;
  slug: string;
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

const KIND_REVIEW = 'review-invite';

export function signReviewToken(orderId: string, slug: string, expiresInDays = 90): string {
  const payload: TokenPayload = {
    orderId,
    slug,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const payloadEncoded = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${KIND_REVIEW}.${payloadEncoded}`)
    .digest();
  return `${payloadEncoded}.${base64UrlEncode(sig)}`;
}

export interface VerifyOk {
  valid: true;
  orderId: string;
  slug: string;
  exp: number;
}
export interface VerifyFailure {
  valid: false;
  reason: 'malformed' | 'signature' | 'expired';
}

export function verifyReviewToken(token: string): VerifyOk | VerifyFailure {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadEncoded, sigEncoded] = parts;
  let expectedSig: Buffer;
  let providedSig: Buffer;
  try {
    expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(`${KIND_REVIEW}.${payloadEncoded}`)
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
  if (
    typeof payload.orderId !== 'string' ||
    typeof payload.slug !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { valid: false, reason: 'malformed' };
  }
  if (payload.exp < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, orderId: payload.orderId, slug: payload.slug, exp: payload.exp };
}
