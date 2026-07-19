/**
 * Account auth — magic-link tokens + signed session cookies for storefront customers.
 *
 * Invariants:
 *   - Shares `CART_RECOVERY_HMAC_SECRET` with `recovery-token.ts` and the admin auth.
 *     Rotating the secret = forced logout for every customer + invalidates all
 *     in-flight magic links and recovery URLs.
 *   - Magic-link token = `base64url({ email, locale, nonce, exp }).base64url(hmac)`.
 *     `email` is lowercased at issue. TTL 15 minutes. Single-use enforced
 *     out-of-band by the nonce store in `account-tokens.ts`.
 *   - Session token = `base64url({ email, exp }).base64url(hmac)`. TTL 30 days.
 *   - Cookie name pinned to `ACCOUNT_COOKIE_NAME` (distinct from admin cookie).
 * Side effects: reads `CART_RECOVERY_HMAC_SECRET` env var.
 * Caller contract: `/api/account/request-link` issues magic-link tokens,
 *   `/api/account/verify` consumes them and issues session tokens, server
 *   components on `/[locale]/account` MUST gate via `getAccountSessionEmail()`.
 */
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { serverEnv } from '@/env';

/** Default magic-link TTL — used by the "request a link" flow where the
 *  user just typed the email and is expected to click within minutes. */
export const MAGIC_LINK_DEFAULT_TTL_MS = 15 * 60 * 1000;

/** Longer TTL for magic links embedded in transactional emails (order
 *  confirmation, shipment notice). 30 days — long enough that the recipient
 *  can click from an inbox days later, short enough that a mailbox
 *  compromise discovered months/years later does not give standing access.
 *  Single-use is enforced by the Mongo nonce store; this window caps the
 *  pre-consumption replay risk. */
export const MAGIC_LINK_LONG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const ACCOUNT_COOKIE_NAME = 'sf_account_session';
export const ACCOUNT_COOKIE_MAX_AGE_S = SESSION_DURATION_MS / 1000;

function getSecret(): string {
  const s = serverEnv.CART_RECOVERY_HMAC_SECRET;
  if (!s) throw new Error('CART_RECOVERY_HMAC_SECRET missing — required for account auth');
  return s;
}

export function isAccountAuthConfigured(): boolean {
  return Boolean(serverEnv.CART_RECOVERY_HMAC_SECRET);
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

// HMAC context-binding: each token class signs with a `kind` prefix so a
// token issued as one kind cannot be replayed as another (e.g. magic link
// presented as a session cookie). All sibling auth modules (admin-auth,
// recovery-token) follow the same scheme; cross-kind use fails the
// signature check, not just a payload-shape check.
const KIND_MAGIC = 'account-magic';
const KIND_SESSION = 'account-session';

function sign(payload: string, kind: string): string {
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(`${kind}.${payload}`)
    .digest();
  return base64Url(sig);
}

function verifySig(payload: string, sigEncoded: string, kind: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(`${kind}.${payload}`)
      .digest();
    const provided = base64UrlDecode(sigEncoded);
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export type MagicLinkLocale = 'ro' | 'en';

export function createMagicLinkToken(
  email: string,
  locale: MagicLinkLocale,
  nonce: string,
  ttlMs: number = MAGIC_LINK_DEFAULT_TTL_MS,
): string {
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        email: email.trim().toLowerCase(),
        locale,
        nonce,
        exp: Date.now() + ttlMs,
      }),
    ),
  );
  return `${payload}.${sign(payload, KIND_MAGIC)}`;
}

export function verifyMagicLinkToken(
  token: string,
): { email: string; locale: MagicLinkLocale; nonce: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sigEncoded] = parts;
  if (!verifySig(payload, sigEncoded, KIND_MAGIC)) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payload).toString('utf8')) as {
      email: unknown;
      locale: unknown;
      nonce: unknown;
      exp: unknown;
    };
    if (typeof data.exp !== 'number' || data.exp <= Date.now()) return null;
    if (typeof data.email !== 'string' || typeof data.nonce !== 'string') return null;
    if (data.locale !== 'ro' && data.locale !== 'en') return null;
    return { email: data.email, locale: data.locale, nonce: data.nonce };
  } catch {
    return null;
  }
}

export function createAccountSessionToken(email: string): string {
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        email: email.trim().toLowerCase(),
        exp: Date.now() + SESSION_DURATION_MS,
      }),
    ),
  );
  return `${payload}.${sign(payload, KIND_SESSION)}`;
}

export function verifyAccountSessionToken(token: string): { email: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sigEncoded] = parts;
  if (!verifySig(payload, sigEncoded, KIND_SESSION)) return null;
  try {
    const data = JSON.parse(base64UrlDecode(payload).toString('utf8')) as {
      email: unknown;
      exp: unknown;
    };
    if (typeof data.exp !== 'number' || data.exp <= Date.now()) return null;
    if (typeof data.email !== 'string') return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

/** Reads the session cookie and returns the verified email, or null if no
 *  valid session. Use from server components on `/[locale]/account`. */
export async function getAccountSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_COOKIE_NAME)?.value;
  if (!token) return null;
  const verified = verifyAccountSessionToken(token);
  return verified?.email ?? null;
}
