/**
 * Admin auth — single-password login + HMAC-signed session cookie.
 *
 * Invariants:
 *   - Shares `CART_RECOVERY_HMAC_SECRET` with `recovery-token.ts`. Rotating the secret = forced admin logout AND invalidates all in-flight recovery URLs.
 *   - Password compare is constant-time via `crypto.timingSafeEqual`; mismatched lengths still consume comparable cycles to mask timing.
 *   - Session token = `base64url({ exp }).base64url(hmac)`; 30-day TTL; `exp` checked AFTER signature verification.
 *   - Session cookie name pinned to `ADMIN_COOKIE_NAME`; the layout at `src/app/admin/(authed)/layout.tsx` is the only consumer.
 * Side effects: reads request cookies via `next/headers`; reads `ADMIN_PASSWORD` and `CART_RECOVERY_HMAC_SECRET` env vars.
 * Caller contract: server components inside `/admin/(authed)` MUST gate on `requireAdmin()`; the login route is the only path that should issue tokens.
 */
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { storage } from '@/site.config';
import { serverEnv } from '@/env';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const ADMIN_COOKIE_NAME = storage.cookie.adminSession;
export const ADMIN_COOKIE_MAX_AGE_S = SESSION_DURATION_MS / 1000;

// Reuse the same HMAC secret as the recovery URLs — cheap and avoids
// proliferating secrets. Rotating this secret invalidates all admin
// sessions in addition to all in-flight recovery URLs, which is fine
// for a single-operator dashboard.
function getSecret(): string {
  const s = serverEnv.CART_RECOVERY_HMAC_SECRET;
  if (!s) {
    throw new Error('CART_RECOVERY_HMAC_SECRET missing — required for admin auth');
  }
  return s;
}

/** Returns whether the admin login is fully configured (password + secret). */
export function isAdminConfigured(): boolean {
  return Boolean(serverEnv.ADMIN_PASSWORD) && Boolean(serverEnv.CART_RECOVERY_HMAC_SECRET);
}

/**
 * Constant-time password comparison. Pads the shorter value to avoid
 * leaking length info in the unlikely case timingSafeEqual length-checks.
 */
export function passwordMatches(input: string): boolean {
  const expected = serverEnv.ADMIN_PASSWORD;
  if (!expected) return false;
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) {
    // Run a dummy compare against itself so the timing of the false branch
    // matches the timing of a length-equal mismatch.
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4;
  const padded = pad ? s + '='.repeat(4 - pad) : s;
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// HMAC context-binding: prefix `kind` into the signed input so a token
// issued for any other class (customer session, magic link, cart recovery)
// — all signed with the same `CART_RECOVERY_HMAC_SECRET` — cannot be
// presented as an admin session. The bare `{exp}` payload shape used to
// accept any well-signed token with a future exp; the context prefix is
// what now distinguishes the admin class.
const KIND_ADMIN = 'admin-session';

export function createSessionToken(): string {
  const payload = base64Url(
    Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DURATION_MS })),
  );
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${KIND_ADMIN}.${payload}`)
    .digest();
  return `${payload}.${base64Url(sig)}`;
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sigEncoded] = parts;
  try {
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(`${KIND_ADMIN}.${payload}`)
      .digest();
    const provided = base64UrlDecode(sigEncoded);
    if (expected.length !== provided.length) return false;
    if (!crypto.timingSafeEqual(expected, provided)) return false;
    const data = JSON.parse(base64UrlDecode(payload).toString('utf8')) as { exp: number };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

/**
 * Read the session cookie and verify. Returns true if the caller is
 * authenticated; false otherwise (no cookie, expired, tampered).
 *
 * Use this from server components inside /admin to gate access. Use the
 * /api/admin/login route handler to actually issue a session.
 */
export async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}
