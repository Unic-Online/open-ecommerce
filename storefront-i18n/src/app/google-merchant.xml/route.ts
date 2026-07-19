import { generateGoogleMerchantFeed } from '@/lib/google-merchant';
import { resolveMarketFromRequest } from '@/i18n/market-resolver';
import { getMarketConfig } from '@/i18n/market-config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const market = resolveMarketFromRequest(request);
  const config = getMarketConfig(market);

  // Phase 3: do not emit a Google Merchant feed for markets whose checkout is
  // not enabled. The plan's SEO launch control says "nu trimite Google Merchant
  // feed pentru market incomplet" — 404 (rather than empty feed) keeps Google
  // from indexing FR products that can't be purchased today.
  if (!config.checkout.enabled) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(generateGoogleMerchantFeed(undefined, new Date(), market), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
