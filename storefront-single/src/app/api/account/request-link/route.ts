/**
 * POST /api/account/request-link  body: { email }
 *
 * Always returns 200 ok:true to the user (no enumeration). If the email has
 * at least one order on file, sends a magic-link email with a single-use
 * token (TTL 15 min, nonce stored in `account_login_tokens`). Rate-limited
 * to 3 requests / email / hour.
 */
import crypto from 'crypto';
import { NextResponse, after } from 'next/server';
import {
  countOrdersByEmail,
  countRecentRequests,
  recordIssuedToken,
  recordRequest,
} from '@/lib/account-tokens';
import {
  createMagicLinkToken,
  isAccountAuthConfigured,
  MAGIC_LINK_DEFAULT_TTL_MS,
} from '@/lib/account-auth';
import { sendEmail } from '@/lib/resend';
import { renderAccountMagicLinkEmail } from '@/lib/emails/account-magic-link';
import { isValidEmail } from '@/lib/validation';
import { originFromRequest } from '@/lib/origin';
import { getMarketConfig } from '@/lib/market';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 3;

export async function POST(request: Request) {
  if (!isAccountAuthConfigured()) {
    return NextResponse.json({ ok: false, reason: 'not-configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }
  const rawEmail = (body as { email?: unknown })?.email;
  if (typeof rawEmail !== 'string' || !isValidEmail(rawEmail)) {
    return NextResponse.json({ ok: false, reason: 'invalid-email' }, { status: 400 });
  }
  const email = rawEmail.trim().toLowerCase();

  // Rate-limit BEFORE doing the order lookup so a flood doesn't hit Mongo
  // for the orders count query repeatedly.
  const recent = await countRecentRequests(email);
  if (recent >= RATE_LIMIT) {
    return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 429 });
  }
  await recordRequest(email);

  const orderCount = await countOrdersByEmail(email);
  if (orderCount === 0) {
    // No enumeration: return ok regardless. The client cannot tell whether
    // the email is on file.
    return NextResponse.json({ ok: true });
  }

  const marketConfig = getMarketConfig();

  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_DEFAULT_TTL_MS);
  await recordIssuedToken(nonce, email, expiresAt);

  const token = createMagicLinkToken(email, nonce);
  const linkUrl = `${originFromRequest(request)}/api/account/verify?token=${encodeURIComponent(token)}`;

  const { subject, html, text } = renderAccountMagicLinkEmail({ linkUrl });

  // Off the response path so response time does NOT depend on whether the
  // email existed (closes the timing oracle that would otherwise let an
  // attacker enumerate addresses by latency). The Resend round-trip is the
  // loudest tell — deferring it makes the known/unknown branches
  // indistinguishable from the outside.
  //
  // Why `after()` and not bare fire-and-forget: on Vercel the function
  // instance is frozen the instant the response returns, so an un-awaited
  // send is abandoned mid-flight and never reaches Resend (the nonce is
  // already recorded, so this manifests as "token issued, email never
  // arrives"). `after()` keeps the instance alive until the send resolves
  // while still flushing the response immediately — same pattern as the
  // order + webhook routes.
  after(async () => {
    try {
      await sendEmail({
        from: marketConfig.contact.fromEmail,
        to: [email],
        subject,
        html,
        text,
      });
    } catch (err) {
      console.error('[account-magic-link] send failed:', err);
    }
  });

  return NextResponse.json({ ok: true });
}
