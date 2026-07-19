import { NextResponse } from 'next/server';
import { ACCOUNT_COOKIE_NAME } from '@/lib/account-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCOUNT_COOKIE_NAME, '', {
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  });
  return response;
}
