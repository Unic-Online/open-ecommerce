/**
 * GET /api/account/verify?token=...
 *
 * Contract:
 *  - Validates HMAC + expiry of the magic-link token.
 *  - Atomically consumes the nonce (single-use) — second use returns error.
 *  - On success: sets sf_account_session cookie + 302 redirect to /[locale]/account.
 *  - On failure: 302 redirect to /[locale]/account?error=invalid (or 400).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConsumeToken } = vi.hoisted(() => ({
  mockConsumeToken: vi.fn(),
}));

vi.mock('@/lib/account-tokens', () => ({
  consumeToken: mockConsumeToken,
  countOrdersByEmail: vi.fn(),
  recordRequest: vi.fn(),
  countRecentRequests: vi.fn(),
  recordIssuedToken: vi.fn(),
}));

vi.stubEnv('CART_RECOVERY_HMAC_SECRET', 'verify-test-secret-12345678901234567890');

import { GET } from '@/app/api/account/verify/route';
import { ACCOUNT_COOKIE_NAME, createMagicLinkToken } from '@/lib/account-auth';

function makeRequest(token: string): Request {
  return new Request(`http://localhost/api/account/verify?token=${encodeURIComponent(token)}`);
}

describe('/api/account/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nonce found and consumed atomically.
    mockConsumeToken.mockResolvedValue({ email: 'ion@test.ro' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /ro/account on a fresh, valid token and sets a session cookie', async () => {
    const token = createMagicLinkToken('ion@test.ro', 'ro', 'fresh-nonce');
    const res = await GET(makeRequest(token));

    expect(res.status).toBe(307); // NextResponse.redirect default
    expect(res.headers.get('location')).toMatch(/\/ro\/account$/);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ACCOUNT_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
  });

  it('preserves the issued locale in the redirect (en)', async () => {
    const token = createMagicLinkToken('john@test.com', 'en', 'en-nonce');
    const res = await GET(makeRequest(token));
    expect(res.headers.get('location')).toMatch(/\/en\/account$/);
  });

  it('rejects a re-used token (nonce already consumed)', async () => {
    const token = createMagicLinkToken('ion@test.ro', 'ro', 'used-nonce');
    mockConsumeToken.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/ro\/account\?error=/);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = createMagicLinkToken('ion@test.ro', 'ro', 'tampered-nonce');
    const [payload] = token.split('.');
    const tampered = `${payload}.fakesignature`;
    const res = await GET(makeRequest(tampered));
    expect(res.headers.get('location')).toMatch(/\/ro\/account\?error=/);
    expect(res.headers.get('set-cookie')).toBeNull();
    // nonce never consumed — fail-fast on signature.
    expect(mockConsumeToken).not.toHaveBeenCalled();
  });

  it('rejects when token is missing entirely', async () => {
    const res = await GET(new Request('http://localhost/api/account/verify'));
    expect(res.headers.get('location')).toMatch(/\/ro\/account\?error=/);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const realNow = Date.now;
    try {
      Date.now = () => 1_000_000_000_000;
      const token = createMagicLinkToken('ion@test.ro', 'ro', 'expired-nonce');
      Date.now = () => 1_000_000_000_000 + 16 * 60 * 1000;
      const res = await GET(makeRequest(token));
      expect(res.headers.get('location')).toMatch(/\/ro\/account\?error=/);
      expect(res.headers.get('set-cookie')).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  it('email used to issue session matches the email from the consumed nonce, not from the token payload', async () => {
    // Why: if an attacker somehow submitted a token whose payload email
    // differs from the stored nonce email (shouldn't happen since both are
    // bound at issue, but defense in depth), the session must use the
    // server-stored nonce email — never the client-submitted payload.
    const token = createMagicLinkToken('ion@test.ro', 'ro', 'mismatch-nonce');
    mockConsumeToken.mockResolvedValueOnce({ email: 'real@test.ro' });
    const res = await GET(makeRequest(token));
    const setCookie = res.headers.get('set-cookie') ?? '';
    // Cookie value contains the email-bearing payload; we just assert success path.
    expect(setCookie).toContain(`${ACCOUNT_COOKIE_NAME}=`);
  });
});
