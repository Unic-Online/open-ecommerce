import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/plugins/abandoned-cart/server/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Mirror the login cookie's hardening flags on clear (defense in depth — a
  // future attribute change shouldn't leave the clearing path mismatched).
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  });
  return response;
}
