import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { resolveMarketFromHost } from '@/i18n/market-resolver';
import { getMarketConfig } from '@/i18n/market-config';

// Host-aware: each market's domain advertises its own sitemap. The market
// resolver falls back to DEFAULT_MARKET for unknown hosts (preview deploys),
// so the dev/preview sitemap line still resolves to a valid base URL.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host');
  const market = resolveMarketFromHost(host);
  const baseUrl = getMarketConfig(market).baseUrl;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block admin surfaces and one-shot recovery URLs from indexing.
        // /api is never useful in search and we keep it private.
        disallow: ['/admin', '/admin/*', '/recover/*', '/api/*'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
