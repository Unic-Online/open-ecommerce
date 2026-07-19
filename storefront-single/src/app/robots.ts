import type { MetadataRoute } from 'next';
import { getMarketConfig } from '@/lib/market';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getMarketConfig().baseUrl;
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
