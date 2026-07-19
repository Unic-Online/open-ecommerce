import { NextResponse } from 'next/server';
import { applyCouponSchema } from '@/lib/validation';
import { validateCoupon } from '@/plugins/abandoned-cart/server/coupons';
import { botGuard } from '@/plugins/abandoned-cart/server/bot-guard';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, reason: 'malformed' }, { status: 400 });
  }

  // Lightweight bot guard so this endpoint isn't a free coupon-validity oracle.
  // Body must include the same `botCheck` token as the cart-sync route.
  const guard = botGuard(request, body);
  if (guard.isBot) {
    return NextResponse.json({ valid: false, reason: 'unknown-code' });
  }

  const parsed = applyCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, reason: 'malformed' }, { status: 400 });
  }

  const { code, email } = parsed.data;

  // No DB → no coupons exist → unknown-code is the truthful response.
  if (isAbandonedCartDryRun()) {
    return NextResponse.json({ valid: false, reason: 'unknown-code', dryRun: true });
  }

  const result = await validateCoupon(code, email);
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason });
  }
  return NextResponse.json({
    valid: true,
    discountPercent: result.discountPercent,
    validUntil: result.validUntil.toISOString(),
  });
}
