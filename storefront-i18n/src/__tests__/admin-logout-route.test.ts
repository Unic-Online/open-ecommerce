/**
 * POST /api/admin/logout (issue #54) — clearing the admin session cookie must
 * mirror the login path's hardening flags (httpOnly, sameSite, path), not just
 * blank the value. Prevents a future attribute drift between set and clear.
 */
import { describe, it, expect } from 'vitest';

import { POST } from '@/app/api/admin/logout/route';
import { ADMIN_COOKIE_NAME } from '@/plugins/abandoned-cart/server/admin-auth';

describe('POST /api/admin/logout', () => {
  it('returns ok and expires the admin cookie with login-matching flags', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const setCookie = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(setCookie).toContain(`${ADMIN_COOKIE_NAME.toLowerCase()}=;`);
    expect(setCookie).toContain('max-age=0');
    expect(setCookie).toContain('httponly');
    expect(setCookie).toContain('samesite=lax');
    expect(setCookie).toMatch(/path=\/(;|$)/);
  });
});
