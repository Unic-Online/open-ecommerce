/**
 * Dynamic sitemap for the single-host storefront.
 *
 * Invariants:
 *   - One entry per logical route on the single market host (no hreflang
 *     alternates — there is only one language).
 *   - Category routes are derived from the `categories` registry; product
 *     detail routes from each category's slugs.
 *   - Transactional surfaces (/checkout, /cart, /order-confirmation/*) are excluded.
 * Side effects: none (pure data generation; no Request-time APIs).
 */
import type { MetadataRoute } from 'next';
import type { ProductCategory } from '@/lib/product';
import { allCategoryKeys, categoryToProductRoute } from '@/lib/product';
import { absoluteUrl } from '@/lib/market';
import { getStaticSlugsForCategory } from '@/lib/catalog';

interface RouteEntry {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

const STATIC_ROUTES: RouteEntry[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  ...allCategoryKeys().map(
    (category): RouteEntry => ({
      path: categoryToProductRoute(category),
      changeFrequency: 'weekly',
      priority: 0.9,
    }),
  ),
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/how-to-order', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/returns', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

const PRODUCT_CATEGORIES: ProductCategory[] = allCategoryKeys();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  for (const entry of STATIC_ROUTES) {
    out.push({
      url: absoluteUrl(entry.path),
      lastModified: now,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    });
  }

  for (const category of PRODUCT_CATEGORIES) {
    for (const slug of getStaticSlugsForCategory(category)) {
      out.push({
        url: absoluteUrl(`${categoryToProductRoute(category)}/${slug}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return out;
}
