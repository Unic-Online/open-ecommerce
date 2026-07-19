/**
 * POST /api/account/logout (issue #19) — must expire the account session
 * cookie with the same hardening flags the login path sets.
 */
import { describe, it, expect } from 'vitest';

import { POST } from '@/app/api/account/logout/route';
import { ACCOUNT_COOKIE_NAME } from '@/lib/account-auth';

describe('POST /api/account/logout', () => {
  it('returns ok and expires the account session cookie', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ACCOUNT_COOKIE_NAME}=`);
    // Empty value + Max-Age=0 ⇒ immediate expiry in every browser.
    expect(setCookie).toMatch(new RegExp(`${ACCOUNT_COOKIE_NAME}=;`));
    expect(setCookie.toLowerCase()).toContain('max-age=0');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie.toLowerCase()).toContain('path=/');
  });

  it('does not scope the cookie to a subpath (path must be /)', async () => {
    const res = await POST();
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie.toLowerCase()).toMatch(/path=\/(;|$)/);
  });
});
