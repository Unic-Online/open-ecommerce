/**
 * Plain navigation primitives for the single-language template.
 *
 * Plain Next navigation (no localized routing). Since
 * there is no locale segment, routes are their canonical English pathnames and
 * `<Link>` / router helpers come straight from Next.
 *
 * `hrefFor()` builds a concrete URL string from a `{ pathname, params }` shape
 * (e.g. `{ pathname: '/furniture/[slug]', params: { slug } }`) for the few
 * dynamic category/product link call sites that used the object-href form.
 *
 * Side effects: none.
 */
export { default as Link } from 'next/link';
export { useRouter, usePathname, redirect, notFound } from 'next/navigation';

export interface HrefObject {
  pathname: string;
  params?: Record<string, string | number>;
}

/** Interpolate `[param]` segments in a pathname template into a URL string. */
export function hrefFor(href: string | HrefObject): string {
  if (typeof href === 'string') return href;
  let out = href.pathname;
  if (href.params) {
    for (const [k, v] of Object.entries(href.params)) {
      out = out.replace(`[${k}]`, String(v));
    }
  }
  return out;
}
