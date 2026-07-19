import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cartSyncSchema } from '@/lib/validation';
import {
  generateCartId,
  upsertCart,
} from '@/plugins/abandoned-cart/server/carts';
import {
  botGuard,
  extractClientIp,
} from '@/plugins/abandoned-cart/server/bot-guard';
import {
  CART_COOKIE_NAME,
  CART_COOKIE_MAX_AGE_DAYS,
} from '@/plugins/abandoned-cart/shared/types';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { resolveMarketFromRequest } from '@/i18n/market-resolver';
import { getMarketConfig } from '@/i18n/market-config';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Bot guard. We return 200 (not 403) so scrapers don't learn they were
  // filtered — they just see a successful no-op.
  const guard = botGuard(request, body);
  if (guard.isBot) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const parsed = cartSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(CART_COOKIE_NAME)?.value;

  // cartId resolution priority: body > cookie > generate.
  // Body wins so a cross-device recovery URL can pin the cartId before any
  // cookie exists on the new device.
  const requestedCartId = data.cartId ?? existingCookie ?? generateCartId();

  const dryRun = isAbandonedCartDryRun();
  // Phase 3: derive commercial market from the request host. Locale defaults
  // to the market's default locale; cart-sync clients can override later by
  // sending an explicit `locale` field.
  const market = resolveMarketFromRequest(request);
  const marketConfig = getMarketConfig(market);
  let finalCartId = requestedCartId;
  if (!dryRun) {
    try {
      const result = await upsertCart({
        cartId: requestedCartId,
        items: data.items.map((it) => ({
          id: it.id,
          productType: it.productType,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          slug: it.slug,
          shortName: it.shortName,
          image: it.image ?? '',
        })),
        subtotal: data.subtotal,
        email: data.email,
        phone: data.phone,
        marketingConsent: data.marketingConsent,
        ipAddress: extractClientIp(request.headers),
        userAgent: request.headers.get('user-agent') ?? undefined,
        market,
        locale: marketConfig.locale,
      });
      finalCartId = result.cartId;
      if (result.rotated) {
        console.info('[cart-sync] rotated', {
          from: requestedCartId,
          to: finalCartId,
        });
      }
    } catch (err) {
      console.error('Cart sync failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  const response = NextResponse.json({
    ok: true,
    cartId: finalCartId,
    ...(dryRun ? { dryRun: true } : {}),
  });
  if (existingCookie !== finalCartId) {
    response.cookies.set(CART_COOKIE_NAME, finalCartId, {
      maxAge: CART_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // Not httpOnly — the client reads this cookie to attach to subsequent
      // sync requests. The cookie carries no secret material; the cartId is
      // a UUID with no value of its own.
      httpOnly: false,
      path: '/',
    });
  }
  return response;
}
