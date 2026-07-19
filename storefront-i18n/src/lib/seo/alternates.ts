/**
 * Builds canonical + hreflang alternates for a logical route.
 *
 * Invariants:
 *   - Production runs each market on its own host (shop.example.com vs
 *     ro.shop.example.com), so language alternates MUST be absolute URLs;
 *     `metadataBase` only applies to relative paths within one host.
 *   - The `href` argument is the canonical pathname key from
 *     `routing.pathnames` (e.g. `/furniture`, `/furniture/[slug]` with params).
 *     `getPathname` rewrites it to the locale-specific slug (`/mobilier`, ...).
 *   - `x-default` points at the active locale's URL — routing users back to the
 *     page they're already on is the safest behavior.
 * Side effects: none.
 */
import type { Metadata } from 'next';
import type { LocaleKey } from '@/i18n/locales';
import { getPathname } from '@/i18n/navigation';
import { MARKETS } from '@/i18n/market-config';
import type { routing } from '@/i18n/routing';

type RoutingPathnames = typeof routing.pathnames;
type StaticHref = keyof RoutingPathnames;
type DynamicHref = {
  pathname: keyof RoutingPathnames;
  params: Record<string, string | string[]>;
};
type Href = StaticHref | DynamicHref;

export interface LocalizedAlternates {
  canonical: string;
  languages: Record<string, string>;
  /** Absolute URL for the active locale — handy for OG `url` and JSON-LD. */
  current: string;
  ro: string;
  en: string;
}

export function buildAlternates(href: Href, activeLocale: LocaleKey): LocalizedAlternates {
  const ro = MARKETS.ro;
  const en = MARKETS.english;
  // Cast: `getPathname` accepts the same Href shape, but its generic narrows
  // by locale and confuses TS when we call it twice with different locales.
  const roPath = getPathname({ href: href as never, locale: 'ro' });
  const enPath = getPathname({ href: href as never, locale: 'en' });
  const roUrl = `${ro.baseUrl}${roPath}`;
  const enUrl = `${en.baseUrl}${enPath}`;
  const current = activeLocale === 'ro' ? roUrl : enUrl;
  return {
    canonical: current,
    languages: {
      'ro-RO': roUrl,
      'en-GB': enUrl,
      'x-default': current,
    },
    current,
    ro: roUrl,
    en: enUrl,
  };
}

/** Convenience: produce a `Metadata['alternates']` block ready to spread. */
export function alternatesMetadata(
  href: Href,
  activeLocale: LocaleKey,
): NonNullable<Metadata['alternates']> {
  const a = buildAlternates(href, activeLocale);
  return {
    canonical: a.canonical,
    languages: a.languages,
  };
}
