// Storefront root layout. Owns the <html>/<body> shell for every public
// route. Sibling root layouts at /admin/layout.tsx, /recover/layout.tsx, and
// /revolut-pay/layout.tsx own their own shells.
import type { Metadata } from "next";
import Script from "next/script";
import { Jost } from "next/font/google";
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
import { getMarketConfig } from "@/lib/market";
import { MarketProvider } from "@/lib/market-context";
import { alternatesMetadata } from "@/lib/seo/alternates";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import { features } from "@/site.config";
import { getTranslations } from "@/lib/strings";
import "./globals.css";

// Why: Playfair_Display, DM_Sans, and Cardo were loaded but never rendered —
// `globals.css` aliases `--font-display` and `--font-body` to
// `var(--font-jost)`. Dropping them removes ~640 ms of render-blocking fetches.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo');
  const marketConfig = getMarketConfig();
  const alternates = alternatesMetadata('/');
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
    },
    twitter: {
      card: 'summary_large_image',
      title: t('layout.ogTitle'),
      description: t('layout.ogDescription'),
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const marketConfig = getMarketConfig();
  const tNav = await getTranslations('navigation');
  const whatsappMessage = encodeURIComponent(tNav('whatsappFloatingMessage'));

  return (
    <html lang="en" className={jost.variable}>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />
        <link rel="preconnect" href="https://connect.facebook.net" crossOrigin="" />
      </head>
      <body>
        <JsonLd data={[organizationSchema(marketConfig), websiteSchema(marketConfig)]} />
        {features.analytics ? <FrontendObservability /> : null}
        <Script
          id="sf-consent-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getBootstrapScript() }}
        />
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
            env-configured ids. The GTM container above only provides the GA4
            *config* tag (page_views) — it has no per-event ecommerce tags
            and no Google Ads tag, so the funnel and purchase events from
            lib/analytics.ts go through gtag directly (`sendGa4Event`) and an
            Ads tag (NEXT_PUBLIC_GOOGLE_ADS_ID, ships unset) is configured
            here too. `send_page_view: false` leaves page_view ownership with
            GTM to avoid double-counting; the Ads (AW-) config deliberately
            keeps its page ping — that's what builds remarketing audiences
            and captures ?gclid= into first-party _gcl_* cookies (built-in
            conversion-linker behavior), and it produces no GA4 page_view.
            The consent bootstrap above already pinned Consent Mode v2
            defaults on the shared dataLayer, so gtag.js respects the user's
            choice from its first hit — with ad_storage denied the AW tag
            sets no ads cookies. */}
        {features.analytics &&
        (clientEnv.NEXT_PUBLIC_GA_ID || clientEnv.NEXT_PUBLIC_GOOGLE_ADS_ID) ? (
          <>
            <Script
              id="ga4-gtag-src"
              strategy="lazyOnload"
              src={`https://www.googletagmanager.com/gtag/js?id=${clientEnv.NEXT_PUBLIC_GA_ID ?? clientEnv.NEXT_PUBLIC_GOOGLE_ADS_ID}`}
            />
            <Script id="ga4-gtag-init" strategy="lazyOnload">
              {[
                `window.dataLayer = window.dataLayer || [];`,
                `window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};`,
                `window.gtag('js', new Date());`,
                clientEnv.NEXT_PUBLIC_GA_ID
                  ? `window.gtag('config', '${clientEnv.NEXT_PUBLIC_GA_ID}', { send_page_view: false });`
                  : '',
                clientEnv.NEXT_PUBLIC_GOOGLE_ADS_ID
                  ? `window.gtag('config', '${clientEnv.NEXT_PUBLIC_GOOGLE_ADS_ID}');`
                  : '',
              ]
                .filter(Boolean)
                .join('\n')}
            </Script>
          </>
        ) : null}
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
      </body>
    </html>
  );
}
