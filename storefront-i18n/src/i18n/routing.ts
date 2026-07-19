import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale, categories } from '@/site.config';
import { getRoutingDomains } from './market-config';

/**
 * Routing config for next-intl.
 *
 * Production split (host → locale, derived from MARKETS in site.config.ts):
 *   - ro.shop.example.com → ro locale only
 *   - shop.example.com    → en locale only
 *
 * Dev / Vercel preview: hosts not in `domains` fall back to
 * `localePrefix: 'as-needed'`, so `/ro/mobilier/<slug>` etc. work without DNS.
 *
 * Category pathnames are GENERATED from the `categories` registry in
 * site.config.ts — adding a category there registers both its listing and
 * its `[slug]` detail route automatically. Static (non-product) pages keep
 * their hand-maintained pathnames below.
 */
function buildCategoryPathnames(): Record<string, Record<(typeof locales)[number], string>> {
  const out: Record<string, Record<(typeof locales)[number], string>> = {};
  for (const cat of categories) {
    // The internal pathname KEY is the canonical (en) path; values are the
    // per-locale localized paths.
    const listingKey = cat.pathnames.en;
    out[listingKey] = { ...cat.pathnames };

    const detailKey = `${listingKey}/[slug]`;
    const detailValue = {} as Record<(typeof locales)[number], string>;
    for (const loc of locales) {
      detailValue[loc] = `${cat.pathnames[loc]}/[slug]`;
    }
    out[detailKey] = detailValue;
  }
  return out;
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  localeDetection: false,
  localePrefix: 'as-needed',
  domains: getRoutingDomains(),
  pathnames: {
    '/': '/',
    ...buildCategoryPathnames(),
    '/despre-noi': { ro: '/despre-noi', en: '/about' },
    '/cum-comand': { ro: '/cum-comand', en: '/how-to-order' },
    '/politica-retur': { ro: '/politica-retur', en: '/returns' },
    '/politica-confidentialitate': {
      ro: '/politica-confidentialitate',
      en: '/privacy-policy',
    },
    '/termeni-conditii': {
      ro: '/termeni-conditii',
      en: '/terms',
    },
    '/comanda': { ro: '/comanda', en: '/cart' },
    '/checkout': '/checkout',
    '/confirmare/[orderId]': {
      ro: '/confirmare/[orderId]',
      en: '/order-confirmation/[orderId]',
    },
    '/contact': '/contact',
    '/account': '/account',
  },
});
