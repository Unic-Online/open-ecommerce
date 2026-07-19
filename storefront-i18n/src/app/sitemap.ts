/**
 * Dynamic sitemap covering both production markets (ro + en).
 *
 * Invariants:
 *   - For each logical route, emits ONE entry per market that publishes that
 *     route. The primary `url` is the locale's own URL on its own host, with
 *     `alternates.languages` linking to every other market that has the route.
 *   - URL slugs come from `routing.pathnames` via `getPathname` so each market
 *     shows its localized path without manual duplication.
 *   - Category routes are derived from the `categories` registry.
 *   - A product slug present in only one market produces one entry.
 *   - Transactional surfaces (/checkout, /comanda, /confirmare/*) are excluded.
 * Side effects: none (pure data generation; no Request-time APIs).
 */
import type { MetadataRoute } from 'next';
import type { LocaleKey } from '@/i18n/locales';
import type { ProductCategory } from '@/lib/product';
import { allCategoryKeys, categoryToProductRoute } from '@/lib/product';
import { getPathname } from '@/i18n/navigation';
import { MARKETS } from '@/i18n/market-config';
import { routing } from '@/i18n/routing';
import { getStaticSlugsForCategory } from '@/i18n/product';

interface RouteEntry {
  href:
    | keyof typeof routing.pathnames
    | { pathname: keyof typeof routing.pathnames; params: Record<string, string> };
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

const STATIC_ROUTES: RouteEntry[] = [
  { href: '/', changeFrequency: 'weekly', priority: 1.0 },
  ...allCategoryKeys().map(
    (category): RouteEntry => ({
      href: categoryToProductRoute(category) as keyof typeof routing.pathnames,
      changeFrequency: 'weekly',
      priority: 0.9,
    }),
  ),
  { href: '/despre-noi', changeFrequency: 'monthly', priority: 0.5 },
  { href: '/cum-comand', changeFrequency: 'monthly', priority: 0.5 },
  { href: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { href: '/politica-retur', changeFrequency: 'yearly', priority: 0.3 },
  { href: '/politica-confidentialitate', changeFrequency: 'yearly', priority: 0.3 },
  { href: '/termeni-conditii', changeFrequency: 'yearly', priority: 0.3 },
];

const PRODUCT_CATEGORIES: ProductCategory[] = allCategoryKeys();

interface PerLocaleUrls {
  ro: string | null;
  en: string | null;
}

function urlsForHref(entry: RouteEntry): PerLocaleUrls {
  const ro = MARKETS.ro;
  const en = MARKETS.english;
  const roPath = getPathname({ href: entry.href as never, locale: 'ro' });
  const enPath = getPathname({ href: entry.href as never, locale: 'en' });
  return {
    ro: `${ro.baseUrl}${roPath}`,
    en: `${en.baseUrl}${enPath}`,
  };
}

function buildPerLocaleEntries(
  entry: RouteEntry,
  urls: PerLocaleUrls,
  lastModified: Date,
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  if (urls.ro) languages['ro-RO'] = urls.ro;
  if (urls.en) languages['en-GB'] = urls.en;

  const out: MetadataRoute.Sitemap = [];
  for (const [tag, url] of [
    ['ro-RO', urls.ro] as const,
    ['en-GB', urls.en] as const,
  ]) {
    if (!url) continue;
    out.push({
      url,
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: { languages: { ...languages, 'x-default': url } },
    });
    void tag;
  }
  return out;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  for (const entry of STATIC_ROUTES) {
    out.push(...buildPerLocaleEntries(entry, urlsForHref(entry), now));
  }

  for (const category of PRODUCT_CATEGORIES) {
    const roSlugs = new Set(getStaticSlugsForCategory('ro' as LocaleKey, category));
    const enSlugs = new Set(getStaticSlugsForCategory('en' as LocaleKey, category));
    const allSlugs = new Set<string>([...roSlugs, ...enSlugs]);
    const detailHref = `${categoryToProductRoute(category)}/[slug]` as keyof typeof routing.pathnames;
    for (const slug of allSlugs) {
      const urls = urlsForHref({
        href: { pathname: detailHref, params: { slug } },
        changeFrequency: 'weekly',
        priority: 0.8,
      });
      if (!roSlugs.has(slug)) urls.ro = null;
      if (!enSlugs.has(slug)) urls.en = null;
      out.push(
        ...buildPerLocaleEntries(
          {
            href: { pathname: detailHref, params: { slug } },
            changeFrequency: 'weekly',
            priority: 0.8,
          },
          urls,
          now,
        ),
      );
    }
  }

  return out;
}
