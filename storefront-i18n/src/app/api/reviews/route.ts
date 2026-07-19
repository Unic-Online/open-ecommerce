/**
 * POST /api/reviews — public product review submission.
 *
 * Every accepted submission lands as `status: 'pending'` (see
 * `lib/reviews-store.ts`) — nothing here ever shows on a product page until
 * an operator approves it from `/admin/reviews`.
 *
 * Abuse guards: a honeypot field (real visitors never fill it) and a rolling
 * 24h per-IP cap. Both fail closed toward "silently no-op" (honeypot) or a
 * plain 429 (rate limit) — never toward exposing which guard tripped.
 *
 * Verified-purchase: an optional signed `rt` token (from the review-request
 * email CTA) is checked against the order it names; any failure (malformed,
 * expired, wrong product) just downgrades the submission to unverified —
 * it never blocks a genuine reviewer over a stale/mistyped link.
 */
import { NextResponse } from 'next/server';
import { getDefinedProduct } from '@/../content/products';
import { reviewSubmitSchema } from '@/lib/validation';
import { extractClientIp } from '@/lib/meta-capi';
import { getMarketForLocale } from '@/i18n/market-config';
import { getOrder } from '@/lib/orders/queries';
import { verifyReviewToken } from '@/lib/orders/review-token';
import { countRecentReviewsByIp, insertPendingReview } from '@/lib/reviews-store';

export const dynamic = 'force-dynamic';

const MAX_REVIEWS_PER_IP_PER_DAY = 5;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }

  const parsed = reviewSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'malformed' }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot tripped — report success so a bot doesn't learn it was
  // filtered (same convention as botGuard-protected routes), but never
  // persist anything.
  if (data.company && data.company.trim().length > 0) {
    return NextResponse.json({ ok: true, verifiedPurchase: false });
  }

  const product = getDefinedProduct(data.slug);
  if (!product) {
    return NextResponse.json({ ok: false, reason: 'unknown-product' }, { status: 400 });
  }

  const clientIp = extractClientIp(request.headers);
  const clientUserAgent = request.headers.get('user-agent')?.slice(0, 2048) ?? undefined;

  if (clientIp) {
    const recentCount = await countRecentReviewsByIp(clientIp);
    if (recentCount >= MAX_REVIEWS_PER_IP_PER_DAY) {
      return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 429 });
    }
  }

  let verifiedPurchase = false;
  let orderId: string | undefined;
  if (data.rt) {
    const verified = verifyReviewToken(data.rt);
    if (verified.valid && verified.slug === data.slug) {
      const order = await getOrder(verified.orderId);
      const hasItem = order?.items.some((item) => item.slug === verified.slug) ?? false;
      if (order && hasItem) {
        verifiedPurchase = true;
        orderId = verified.orderId;
      }
    }
  }

  const result = await insertPendingReview({
    slug: data.slug,
    reviewsKey: product.business.reviewsKey,
    name: data.name.trim(),
    email: data.email?.trim() || undefined,
    rating: data.rating as 1 | 2 | 3 | 4 | 5,
    title: data.title?.trim() || undefined,
    text: data.text.trim(),
    locale: data.locale,
    market: getMarketForLocale(data.locale),
    verifiedPurchase,
    orderId,
    clientIp,
    clientUserAgent,
  });

  if (!result.ok) {
    if (result.reason === 'duplicate') {
      return NextResponse.json({ ok: false, reason: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ ok: false, reason: 'dry-run' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, verifiedPurchase: result.review.verifiedPurchase });
}
