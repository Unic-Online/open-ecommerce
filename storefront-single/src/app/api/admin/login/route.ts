import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_MAX_AGE_S,
  ADMIN_COOKIE_NAME,
  createSessionToken,
  isAdminConfigured,
  passwordMatches,
} from '@/plugins/abandoned-cart/server/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, reason: 'not-configured' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const password =
    typeof body === 'object' && body !== null && typeof (body as { password?: unknown }).password === 'string'
      ? (body as { password: string }).password
      : '';

  if (!passwordMatches(password)) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    maxAge: ADMIN_COOKIE_MAX_AGE_S,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: '/',
  });
  return response;
}
