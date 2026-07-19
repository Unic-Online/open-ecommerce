'use client'

import { clientEnv } from '@/env'
import { usePathname } from '@/i18n/navigation'
import { useParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useEffect } from 'react'
import Script from 'next/script'
import { CONSENT_CHANGED_EVENT, hasMarketingConsent } from '@/lib/consent'
import {
  generateEventId,
  trackEvent,
  trackPageView,
  trackProductView,
  trackViewContent,
  trackAddToCart,
  trackInitiateCheckout,
  getFbp,
  getFbc,
} from '@/lib/analytics'
import type { LocaleKey } from '@/i18n/locales'

// Re-export for backward compatibility with existing consumers
export {
  generateEventId,
  trackEvent,
  trackViewContent,
  trackAddToCart,
  trackInitiateCheckout,
}

const PIXEL_ID = clientEnv.NEXT_PUBLIC_META_PIXEL_ID
const EXTERNAL_ID_KEY = 'sf_ext_id'

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void
    _fbq: (...args: unknown[]) => void
  }
}

/**
 * MetaPixel component — renders the pixel script and tracks page views.
 *
 * Consent flow (Meta Consent Mode v2):
 *   1. The inline bootstrap in layout.tsx runs `beforeInteractive` and sets
 *      window.__sfConsent + Google Consent Mode v2 defaults.
 *   2. This Pixel script (`lazyOnload` — deferred so it doesn't block first
 *      paint) reads window.__sfConsent and calls
 *      `fbq('consent', 'grant'|'revoke')` BEFORE `fbq('init', ...)` so the
 *      very first event respects the choice.
 *   3. The runtime listener below reacts to consent changes (via the
 *      CookieBanner emitting `sf:consent-changed`) and re-issues
 *      `fbq('consent', ...)`. When consent flips to granted, we also fire
 *      a deferred PageView so the algo gets the entry signal.
 */
export default function MetaPixel() {
  const pathname = usePathname()
  const locale = useLocale() as LocaleKey
  // `usePathname()` returns the INTERNAL pathname; for dynamic routes that
  // is the template (`/furniture/[slug]`) — the concrete slug only exists in
  // the route params.
  const params = useParams()
  const slugParam = typeof params?.slug === 'string'
    ? params.slug
    : Array.isArray(params?.slug)
      ? params.slug[0]
      : undefined

  // PageView dedup key. The template pathname is constant across every
  // product of a category, so keying on it alone suppressed PageView on
  // product→product soft navigation; resolve the slug into the key.
  const pageKey = slugParam && pathname.includes('[slug]')
    ? pathname.replace('[slug]', slugParam)
    : pathname

  // Ensure fbp + fbc cookies are read as early as possible (no synthetic _fbp).
  useEffect(() => {
    getFbp()
    getFbc()
  }, [pathname])

  // React to consent changes — Meta CMv2 expects `fbq('consent', ...)` calls,
  // not a re-init. Same Pixel ID, just toggles the queue.
  useEffect(() => {
    const onConsent = (e: Event) => {
      if (typeof window === 'undefined' || !window.fbq) return
      const detail = (e as CustomEvent).detail as { marketing?: boolean } | undefined
      if (detail?.marketing) {
        window.fbq('consent', 'grant')
        // Fire a fresh PageView so the algo sees the post-consent entry.
        // trackPageView leaves the dedup key untouched on consent-blocked
        // attempts, so this call is the first one that actually fires.
        trackPageView(pageKey)
      } else {
        window.fbq('consent', 'revoke')
      }
    }
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent)
  }, [pageKey])

  // Track page views on route change (gated inside trackEvent on consent).
  // The slug param is a dependency: product→product soft navigation within
  // the same category keeps the template pathname constant, so only the
  // param changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      trackPageView(pageKey)
      trackProductView({ pathname, slug: slugParam, locale })
    }, 300)

    return () => clearTimeout(timer)
  }, [pageKey, pathname, slugParam, locale])

  if (!PIXEL_ID) {
    console.warn('Meta Pixel ID not set. Add NEXT_PUBLIC_META_PIXEL_ID to .env.local')
    return null
  }

  // The init snippet is rendered server-side; we cannot read consent here.
  // Read it inline at script-execution time from window.__sfConsent (set
  // by the bootstrap inline script in layout.tsx). Pixel auto-hashes the
  // external_id Advanced Matching value but we still only pass it when
  // marketing consent is granted, to honor the principle of data
  // minimization.
  return (
    <>
      <Script
        id="meta-pixel"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');

            (function(){
              var c = window.__sfConsent;
              var marketing = !!(c && c.marketing);
              fbq('consent', marketing ? 'grant' : 'revoke');
              var initOpts = {};
              if (marketing) {
                try {
                  var k='${EXTERNAL_ID_KEY}';
                  var v=localStorage.getItem(k);
                  if(!v){
                    v='sf_'+Date.now()+'_'+Math.random().toString(36).substr(2,9);
                    localStorage.setItem(k,v);
                  }
                  initOpts.external_id = v;
                } catch(e) {}
              }
              fbq('init', '${PIXEL_ID}', initOpts);
            })();
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}

// Helper exposed for tests and internal callers.
export { hasMarketingConsent }
