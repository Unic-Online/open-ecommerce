// Storefront root layout. Owns the <html>/<body> shell for every public
// route under /[locale]/**. Sibling root layouts at /admin/layout.tsx,
// /recover/layout.tsx, and /revolut-pay/layout.tsx own their own shells —
// the project no longer has a global app/layout.tsx (next-intl pattern:
// each top-level segment is its own root layout).
import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Jost } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { clientEnv } from "@/env";
import FrontendObservability from "@/components/FrontendObservability";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MetaPixel from "@/components/MetaPixel";
import CartSidebar from "@/components/CartSidebar";
import CookieBanner from "@/components/CookieBanner";
import ExperimentAssignment from "@/components/ExperimentAssignment";
import JsonLd from "@/components/seo/JsonLd";
import { AbandonedCartPlugin } from "@/plugins/abandoned-cart";
import { CartProvider } from "@/lib/cart-context";
import { getBootstrapScript } from "@/lib/consent";
import { routing } from "@/i18n/routing";
import { getMarketConfig, getMarketForLocale } from "@/i18n/market-config";
import { MarketProvider } from "@/i18n/market-context";
import { alternatesMetadata } from "@/lib/seo/alternates";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import { features } from "@/site.config";
import type { LocaleKey } from "@/i18n/locales";
import "../globals.css";

// Why: Playfair_Display, DM_Sans, and Cardo were loaded but never rendered —
// `globals.css` aliases `--font-display` and `--font-body` to
// `var(--font-jost)`, and `--font-cardo` has zero CSS references. Dropping
// them removes ~640 ms of render-blocking woff2 fetches on cold loads.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safeLocale, namespace: 'common.seo' });
  const market = getMarketForLocale(safeLocale);
  const marketConfig = getMarketConfig(market);
  const altLocale = safeLocale === 'ro' ? 'en-GB' : 'ro-RO';
  const alternates = alternatesMetadata('/', safeLocale as LocaleKey);
  return {
    metadataBase: new URL(marketConfig.baseUrl),
    title: {
      default: t('layout.title'),
      template: t('titleTemplate'),
    },
    description: t('layout.description'),
    keywords: t('layout.keywords'),
    alternates,
    openGraph: {
      title: t('layout.ogTitle'),
      description: t('layout.ogDescription'),
      url: marketConfig.baseUrl,
      siteName: t('siteName'),
      type: 'website',
      locale: marketConfig.languageTag,
      alternateLocale: altLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('layout.ogTitle'),
      description: t('layout.ogDescription'),
    },
    verification: {
      other: {
        'facebook-domain-verification':
          market === 'english' ? '' : 'f1pq9gpdmsw658mweyeiobjqavz857',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  // Production routing (`src/i18n/routing.ts: domains`) enforces a 1:1
  // host↔locale split, so the locale segment fully determines the market.
  // Using a pure locale→market resolver keeps this layout statically
  // renderable; API routes and the merchant feed still call the async
  // `getCurrentMarket()` because they have legitimate per-request inputs.
  const market = getMarketForLocale(locale);
  const marketConfig = getMarketConfig(market);
  const tNav = await getTranslations({ locale, namespace: 'navigation' });
  const whatsappMessage = encodeURIComponent(tNav('whatsappFloatingMessage'));

  return (
    <html lang={locale} className={jost.variable}>
      <head>
        {/* Preconnect to third-party tracker origins so the TLS handshake
            happens in parallel with our own resources. The audit flagged
            ~200 ms of avoidable latency from GTM + Facebook on cold loads. */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />
        <link rel="preconnect" href="https://connect.facebook.net" crossOrigin="" />
      </head>
      <body>
        <JsonLd data={[organizationSchema(marketConfig), websiteSchema(marketConfig)]} />
        {/* Faro browser observability is part of the analytics subsystem. */}
        {features.analytics ? <FrontendObservability /> : null}
        {/* GDPR consent bootstrap — runs before any tracker so Pixel and
            GTM respect the choice from their first hit. Reads
            localStorage, sets window.__sfConsent + Google Consent Mode v2
            defaults. Listens for the consent-changed event and dispatches
            gtag('consent','update',...) on banner clicks. NOT gated by the
            analytics flag: GDPR consent is required regardless of trackers. */}
        <Script
          id="sf-consent-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getBootstrapScript() }}
        />
        {/* GTM container — GA4 and Microsoft Clarity are configured inside
            it. Deferred to `lazyOnload` so it doesn't compete with first
            paint; the consent bootstrap above already pinned the Consent
            Mode v2 defaults, so any tag fired by GTM respects the user's
            choice from the first hit. Tradeoff: very early page exits
            (< ~3 s) may be missed. Gated by the analytics feature flag. */}
        {features.analytics && clientEnv.NEXT_PUBLIC_GTM_ID ? (
          <Script id="gtm-init" strategy="lazyOnload">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${clientEnv.NEXT_PUBLIC_GTM_ID}');`}
          </Script>
        ) : null}
        {/* GA4 + optional Google Ads via gtag.js, loaded directly with the
            per-market ids. The GTM container above only provides the GA4
            *config* tag (page_views) — it has no per-event ecommerce tags
            and no Google Ads tag, so the funnel and purchase events from
            lib/analytics.ts go through gtag directly (`sendGa4Event`) and
            an Ads tag (analytics.googleAdsId, ships unset) is configured
            here too. `send_page_view: false` leaves page_view ownership
            with GTM to avoid double-counting; the Ads (AW-) config
            deliberately keeps its page ping — that's what builds
            remarketing audiences and captures ?gclid= into first-party
            _gcl_* cookies (built-in conversion-linker behavior), and it
            produces no GA4 page_view. The consent bootstrap above already
            pinned Consent Mode v2 defaults on the shared dataLayer, so
            gtag.js respects the user's choice from its first hit — with
            ad_storage denied the AW tag sets no ads cookies. */}
        {features.analytics &&
        (marketConfig.analytics.gaId || marketConfig.analytics.googleAdsId) ? (
          <>
            <Script
              id="ga4-gtag-src"
              strategy="lazyOnload"
              src={`https://www.googletagmanager.com/gtag/js?id=${marketConfig.analytics.gaId ?? marketConfig.analytics.googleAdsId}`}
            />
            <Script id="ga4-gtag-init" strategy="lazyOnload">
              {[
                `window.dataLayer = window.dataLayer || [];`,
                `window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};`,
                `window.gtag('js', new Date());`,
                marketConfig.analytics.gaId
                  ? `window.gtag('config', '${marketConfig.analytics.gaId}', { send_page_view: false });`
                  : '',
                marketConfig.analytics.googleAdsId
                  ? `window.gtag('config', '${marketConfig.analytics.googleAdsId}');`
                  : '',
              ]
                .filter(Boolean)
                .join('\n')}
            </Script>
          </>
        ) : null}
        <NextIntlClientProvider>
          <MarketProvider value={marketConfig}>
            <CartProvider>
              <ExperimentAssignment />
              {features.analytics ? <MetaPixel /> : null}
              <Header />
              <main style={{ paddingTop: '64px' }}>{children}</main>
              <Footer />
              <CartSidebar />
              {marketConfig.contact.whatsappNumber ? (
                <a
                  href={`https://wa.me/${marketConfig.contact.whatsappNumber}?text=${whatsappMessage}`}
                  className="floating-wa"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tNav('whatsappAria')}
                >
                  💬
                </a>
              ) : null}
              <CookieBanner />
              {features.abandonedCart ? <AbandonedCartPlugin /> : null}
            </CartProvider>
          </MarketProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
