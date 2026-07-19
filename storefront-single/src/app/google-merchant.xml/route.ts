import { generateGoogleMerchantFeed } from '@/lib/google-merchant';
import { getMarketConfig } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getMarketConfig();

  // Do not emit a Google Merchant feed when checkout is not enabled — 404
  // (rather than an empty feed) keeps Google from indexing products that
  // can't be purchased.
  if (!config.checkout.enabled) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(generateGoogleMerchantFeed(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
