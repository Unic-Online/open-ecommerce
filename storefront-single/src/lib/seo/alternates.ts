/**
 * Builds the canonical alternate for a route on the single market host.
 *
 * Single-language, single-host template: there are no hreflang language
 * alternates. The canonical is simply the absolute URL of the page.
 *
 * Side effects: none.
 */
import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/market';
import { hrefFor, type HrefObject } from '@/lib/nav';

type Href = string | HrefObject;

export interface CanonicalAlternates {
  canonical: string;
  /** Absolute URL for the page — handy for OG `url` and JSON-LD. */
  current: string;
}

export function buildAlternates(href: Href): CanonicalAlternates {
  const path = hrefFor(href);
  const url = absoluteUrl(path);
  return { canonical: url, current: url };
}

/** Convenience: produce a `Metadata['alternates']` block ready to spread. */
export function alternatesMetadata(href: Href): NonNullable<Metadata['alternates']> {
  const a = buildAlternates(href);
  return { canonical: a.canonical };
}
