import crypto from 'node:crypto';
import { getTestDb } from './db';
import { e2eSecrets } from '../../playwright.config';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Mirror the server's HMAC context-binding: each token class signs with a
// distinct `kind` prefix so a token from one class cannot pass another
// verifier. Keep these strings synchronized with KIND_MAGIC / KIND_SESSION
// in src/lib/account-auth.ts.
const KIND_MAGIC = 'account-magic';
const KIND_SESSION = 'account-session';

function sign(payload: string, kind: string): string {
  const sig = crypto
    .createHmac('sha256', e2eSecrets.hmacSecret)
    .update(`${kind}.${payload}`)
    .digest();
  return base64Url(sig);
}

function buildMagicLinkToken(
  email: string,
  locale: 'ro' | 'en',
  nonce: string,
): string {
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        email: email.toLowerCase(),
        locale,
        nonce,
        exp: Date.now() + MAGIC_LINK_TTL_MS,
      }),
    ),
  );
  return `${payload}.${sign(payload, KIND_MAGIC)}`;
}

function buildAccountSessionToken(email: string): string {
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        email: email.toLowerCase(),
        exp: Date.now() + SESSION_DURATION_MS,
      }),
    ),
  );
  return `${payload}.${sign(payload, KIND_SESSION)}`;
}

/**
 * Issue a magic-link token + persist its nonce in Mongo so the
 * `/api/account/verify` route accepts it on first use. Returns a fully
 * qualified verify URL bound to the supplied baseURL (Playwright `baseURL`).
 */
export async function seedMagicLink(args: {
  email: string;
  locale?: 'ro' | 'en';
  baseURL: string;
}): Promise<{ url: string; nonce: string }> {
  const locale = args.locale ?? 'ro';
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  const db = await getTestDb();
  await db.collection('account_login_tokens').insertOne({
    nonce,
    email: args.email.toLowerCase(),
    expiresAt,
  });

  const token = buildMagicLinkToken(args.email, locale, nonce);
  const url = `${args.baseURL}/api/account/verify?token=${encodeURIComponent(token)}`;
  return { url, nonce };
}

/** Mints an account session cookie value directly. Use to skip the magic-link
 *  flow when a test only cares about dashboard rendering. */
export function buildAccountSessionCookieValue(email: string): string {
  return buildAccountSessionToken(email);
}

export async function deleteMagicLinkNonces(email: string): Promise<void> {
  const db = await getTestDb();
  await db
    .collection('account_login_tokens')
    .deleteMany({ email: email.toLowerCase() });
  await db
    .collection('account_login_attempts')
    .deleteMany({ email: email.toLowerCase() });
}
