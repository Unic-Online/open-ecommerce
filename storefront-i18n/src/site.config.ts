/**
 * Single source of truth for ALL brand / business / site configuration.
 *
 * This module is the one file an operator (or an AI agent) edits to rebrand
 * the whole template: brand name, logos, markets, locales, storage key
 * namespaces, commerce defaults, trademark, analytics. The values below are
 * the generic "Acme Store" demo brand; an operator swaps the *values* without
 * touching the *structure* or any of the ~40 downstream consumers.
 *
 * Invariants:
 *   - PURE DATA + TYPES ONLY. This file MUST be importable from both client
 *     and server bundles, so it must never import `next/headers` or anything
 *     server-only. The request-aware helpers (getCurrentMarket, etc.) live in
 *     `src/i18n/market-resolver.ts`; the pure locale→market helpers live in
 *     `src/i18n/market-config.ts` and re-import the data from here.
 *   - Re-export modules (`src/i18n/locales.ts`, `src/i18n/market-config.ts`,
 *     `src/lib/constants.ts`) keep their existing public API so downstream
 *     imports don't change — they just source their data from this file.
 *   - `baseUrl` MUST not have a trailing slash (see `absoluteUrl`).
 *   - Storage values are runtime-observable (localStorage keys, cookie names,
 *     Mongo DB name). Changing them invalidates existing browser/DB state, so
 *     a rebrand pass must migrate or accept the reset.
 * Side effects: none.
 */

// ---------------------------------------------------------------------------
// Locales (UI languages)
// ---------------------------------------------------------------------------

export const locales = ['en', 'ro'] as const;
export type LocaleKey = (typeof locales)[number];
export const defaultLocale: LocaleKey = 'en';

// ---------------------------------------------------------------------------
// Categories (product taxonomy — drives routes, nav, listings)
// ---------------------------------------------------------------------------

/**
 * Category registry — the single source of truth for the product taxonomy.
 *
 * Adding a category here + the two thin route files
 * (`src/app/[locale]/<key>/page.tsx` and `<key>/[slug]/page.tsx`) is all it
 * takes to publish a new section: `routing.ts` generates its localized
 * pathnames from `pathnames`, the cart type id derives from `key`, and the
 * nav/home/listing pages read labels from here (with messages overrides).
 *
 * Invariants:
 *   - `key` IS the cart product-type id. Catalog ids are `${key}__${slug}`
 *     (see `src/data/products/catalog.ts`, `prices.ts`). Changing a key
 *     re-namespaces existing carts/prices.
 *   - `pathnames[locale]` MUST start with '/' and be unique across categories
 *     and static routes. They feed `routing.ts` verbatim.
 *   - Every `LocaleKey` MUST have a pathname + label entry.
 */
export interface CategoryConfig {
  key: string;
  pathnames: Record<LocaleKey, string>;
  labels: Record<LocaleKey, string>;
}

export const categories = [
  {
    key: 'furniture',
    pathnames: { en: '/furniture', ro: '/mobilier' },
    labels: { en: 'Furniture', ro: 'Mobilier' },
  },
  {
    key: 'lighting',
    pathnames: { en: '/lighting', ro: '/iluminat' },
    labels: { en: 'Lighting', ro: 'Iluminat' },
  },
  {
    key: 'outdoor',
    pathnames: { en: '/outdoor', ro: '/exterior' },
    labels: { en: 'Outdoor', ro: 'Exterior' },
  },
] as const satisfies readonly CategoryConfig[];

/** Derived union of category keys — the canonical `ProductCategory` type. */
export type ProductCategory = (typeof categories)[number]['key'];

// ---------------------------------------------------------------------------
// Markets (commercial markets — currency, shipping, legal entity, contact)
// ---------------------------------------------------------------------------

export type MarketKey = 'ro' | 'english';
export type CurrencyCode = 'RON' | 'EUR';

export interface MarketConfig {
  key: MarketKey;
  locale: LocaleKey;
  languageTag: string;
  /** Customer-facing brand name. May differ across markets. */
  name: string;
  domain: string;
  /**
   * Extra hosts that should resolve to this market in production.
   * Use for `www.` aliases, future apex variants, or rebrand redirects.
   * The next-intl middleware only consumes the primary `domain`; this list
   * is consumed by `market-resolver.ts` for API + RSC host resolution.
   */
  domainAliases?: string[];
  baseUrl: string;
  currency: CurrencyCode;
  shipping: {
    standardCost: number;
    freeThreshold: number;
    supportedCountries: string[];
    defaultCountryCode: string;
  };
  checkout: {
    enabled: boolean;
    paymentMethods: Array<'ramburs' | 'card'>;
  };
  contact: {
    businessEmail: string;
    fromEmail: string;
    whatsappNumber: string;
    whatsappDisplay: string;
    /** Internal recipients of the merchant copy of order confirmations. */
    merchantNotificationEmails: string[];
  };
  legal: {
    /** Country where the legal entity is registered (used for invoicing / RGPD wording). */
    entityCountryCode: string;
    entityName: string;
  };
  analytics: {
    gaId?: string;
    metaPixelId?: string;
    /**
     * Optional Google Ads conversion-tracking id (`AW-…`). When set, the
     * shared gtag.js install in `[locale]/layout.tsx` adds a
     * `gtag('config', …)` for it: page pings build remarketing audiences
     * and capture `gclid` into first-party `_gcl_*` cookies (built-in
     * conversion-linker behavior), gated by Consent Mode v2 `ad_storage`.
     * Ships unset — the template never points at a live Ads account.
     */
    googleAdsId?: string;
  };
  googleMerchant?: {
    targetCountry: string;
    language: string;
  };
}

export const MARKETS: Record<MarketKey, MarketConfig> = {
  ro: {
    key: 'ro',
    locale: 'ro',
    languageTag: 'ro-RO',
    name: 'Acme Store',
    domain: 'ro.shop.example.com',
    domainAliases: ['www.ro.shop.example.com'],
    baseUrl: 'https://ro.shop.example.com',
    currency: 'RON',
    shipping: {
      // Mirrors `STANDARD_SHIPPING_COST` / `FREE_SHIPPING_THRESHOLD` in
      // src/lib/pricing.ts. Keep in sync until Phase 4 sweeps callers.
      standardCost: 29,
      freeThreshold: 600,
      supportedCountries: ['RO'],
      defaultCountryCode: 'RO',
    },
    checkout: {
      enabled: true,
      paymentMethods: ['ramburs', 'card'],
    },
    contact: {
      businessEmail: 'contact@example.com',
      fromEmail: 'Acme Store <orders@example.com>',
      whatsappNumber: '',
      whatsappDisplay: '',
      merchantNotificationEmails: ['contact@example.com'],
    },
    legal: {
      entityName: 'Acme Store Demo SRL',
      entityCountryCode: 'RO',
    },
    analytics: {
      // GA measurement ID is env-driven only (NEXT_PUBLIC_GA_ID); the template
      // ships without a hardcoded property. Leaving `gaId` unset here keeps the
      // demo free of a live analytics tie.
    },
    googleMerchant: {
      targetCountry: 'RO',
      language: 'ro',
    },
  },
  english: {
    // Default international English market — the primary demo storefront on
    // `shop.example.com`. Checkout is enabled so the demo is fully functional
    // end-to-end. Per-product EUR prices live in `src/data/products/prices.ts`.
    key: 'english',
    locale: 'en',
    languageTag: 'en-GB',
    name: 'Acme Store',
    // Apex serves the storefront; `www.` is configured as an alias.
    domain: 'shop.example.com',
    domainAliases: ['www.shop.example.com'],
    baseUrl: 'https://shop.example.com',
    currency: 'EUR',
    shipping: {
      // Placeholder — flat carrier fee mirroring FR while a real
      // international quote is finalised. Free over €300 (subtotal).
      standardCost: 10,
      freeThreshold: 300,
      supportedCountries: ['GB'],
      defaultCountryCode: 'GB',
    },
    checkout: {
      // Default market for the template — checkout enabled so the demo
      // storefront is fully functional end-to-end. Per-product EUR prices
      // live in `src/data/products/prices.ts`.
      enabled: true,
      paymentMethods: ['card'],
    },
    contact: {
      businessEmail: 'contact@example.com',
      fromEmail: 'Acme Store <orders@example.com>',
      // Empty WhatsApp number hides the floating WhatsApp link in
      // `[locale]/layout.tsx`.
      whatsappNumber: '',
      whatsappDisplay: '',
      merchantNotificationEmails: ['contact@example.com'],
    },
    legal: {
      entityName: 'Acme Store Demo SRL',
      entityCountryCode: 'RO',
    },
    analytics: {
      // GA measurement ID is env-driven only (NEXT_PUBLIC_GA_ID).
    },
    googleMerchant: {
      targetCountry: 'GB',
      language: 'en',
    },
  },
};

export const DEFAULT_MARKET: MarketKey = 'english';

// ---------------------------------------------------------------------------
// Brand (logos, site name) — cross-market visual identity
// ---------------------------------------------------------------------------

export interface BrandConfig {
  /** Generic site name. Per-market customer-facing names live in MARKETS[*].name. */
  siteName: string;
  logo: {
    /** Header logo (public-relative path). */
    header: string;
    /** Footer logo (public-relative path). */
    footer: string;
  };
}

export const brand: BrandConfig = {
  siteName: 'Acme Store',
  logo: {
    header: '/logo.svg',
    footer: '/logo.svg',
  },
};

// ---------------------------------------------------------------------------
// Analytics (top-level, non-market-aware)
// ---------------------------------------------------------------------------

export interface AnalyticsConfig {
  /**
   * GA4 measurement ID. GA4 is actually loaded through the GTM container
   * (`NEXT_PUBLIC_GTM_ID`), so this is the configured property for reference
   * and for any non-market-aware consumer. Per-market overrides live in
   * MARKETS[*].analytics.gaId (currently identical across markets).
   */
  gaId?: string;
}

export const analytics: AnalyticsConfig = {
  // Env-driven only (NEXT_PUBLIC_GA_ID). The template ships without a
  // hardcoded GA property so the demo never points at a live account.
};

// ---------------------------------------------------------------------------
// Storage (browser localStorage keys, cookie names, Mongo DB name)
// ---------------------------------------------------------------------------

/**
 * Centralized browser-storage + DB namespacing. Every literal here was
 * previously scattered across consumers; changing a value here re-namespaces
 * the corresponding state everywhere at once (and invalidates existing state).
 *
 * Note: `consentLocalStorage` is versioned. The consent module appends the
 * consent schema version (`sf_consent_v${version}`), so this is the prefix
 * BEFORE the version suffix.
 */
export interface StorageConfig {
  localStorage: {
    /** Cart contents. */
    cart: string;
    /** Pre-fill email for checkout + Meta event matching. */
    userEmail: string;
    /** '1' once the timed email popup was dismissed. */
    emailPopupDismissed: string;
    /** '1' once the exit-intent form was submitted successfully. */
    exitIntentDismissed: string;
    /** '1' after the exit-intent popup first displayed (gates mobile popstate). */
    exitIntentPopupDisplayed: string;
    /** ms timestamp of the most recent exit-intent show (cooldown). */
    exitIntentLastShown: string;
    /** Mobile back-button hijack state keys (CartBounty port). */
    exitIntentTouches: string;
    exitIntentHistoryClicks: string;
    exitIntentTouchesObjectDeleted: string;
    exitIntentJustFinishedLoop: string;
  };
  /** Prefix for the versioned GDPR consent localStorage key (`<prefix>v<version>`). */
  consentLocalStoragePrefix: string;
  cookie: {
    /** UUIDv4 mirrored cart id (abandoned-cart plugin). */
    cartId: string;
    /** HMAC-signed admin session cookie. */
    adminSession: string;
  };
  /** Default Mongo database name; overridable via MONGODB_DB_NAME. */
  mongoDbName: string;
}

export const storage: StorageConfig = {
  localStorage: {
    cart: 'storefront-cart',
    userEmail: 'sf_user_email',
    emailPopupDismissed: 'sf_email_popup_dismissed',
    exitIntentDismissed: 'sf_exit_intent_dismissed',
    exitIntentPopupDisplayed: 'sf_exit_intent_popup_displayed',
    exitIntentLastShown: 'sf_exit_intent_last_shown',
    exitIntentTouches: 'sf_exit_intent_touches',
    exitIntentHistoryClicks: 'sf_exit_intent_history_clicks',
    exitIntentTouchesObjectDeleted: 'sf_exit_intent_touches_object_deleted',
    exitIntentJustFinishedLoop: 'sf_exit_intent_just_finished_loop',
  },
  consentLocalStoragePrefix: 'sf_consent_',
  cookie: {
    cartId: 'sf_cart_id',
    adminSession: 'sf_admin_session',
  },
  mongoDbName: 'storefront',
};

// ---------------------------------------------------------------------------
// Commerce (cross-market commercial constants)
// ---------------------------------------------------------------------------

export interface CommerceConfig {
  /** Prefix for recovery coupon codes (`<prefix>-XXXX-XXXX`). */
  couponPrefix: string;
}

export const commerce: CommerceConfig = {
  couponPrefix: 'SHOP',
};

// ---------------------------------------------------------------------------
// Feature flags (master switches for optional subsystems)
// ---------------------------------------------------------------------------

/**
 * Coarse-grained feature flags. Each flag, when `false`, makes its subsystem
 * fully inert WITHOUT breaking the build or tests — gating happens at the
 * layout/route level (server-side `notFound()` / unmounted client roots), not
 * by sprinkling conditionals deep inside components.
 *
 * Flags default to `true` in the template so the demo is fully functional.
 * They compose with finer-grained env toggles where those exist — e.g.
 * `abandonedCart` is the master switch above the `NEXT_PUBLIC_ABANDONED_CART_*`
 * env sub-toggles.
 *
 *   - `admin`         /admin/** pages + /api/admin/** routes (404 when off).
 *   - `abandonedCart` exit-intent popup, cart sync, recovery cron + endpoints.
 *   - `analytics`     Meta Pixel, GTM/GA, Faro, Meta CAPI route + replay cron.
 *                     (GDPR consent banner is NOT analytics — it stays on.)
 *   - `merchantFeed`  /google-merchant.xml (404 when off).
 *   - `accounts`      /account page + /api/account/** + header account link.
 */
export interface FeaturesConfig {
  admin: boolean;
  abandonedCart: boolean;
  analytics: boolean;
  merchantFeed: boolean;
  accounts: boolean;
}

export const features: FeaturesConfig = {
  admin: true,
  abandonedCart: true,
  analytics: true,
  merchantFeed: true,
  accounts: true,
};

// ---------------------------------------------------------------------------
// Trademark (optional — render nothing when absent)
// ---------------------------------------------------------------------------

export interface TrademarkConfig {
  holder: {
    name: string;
    address: string;
  };
  representative: {
    name: string;
    address: string;
  };
  registrationNumber: string;
  registrationDate: string;
  trademarkNumber: string;
  procedureCompleted: string;
  type: string;
  colors: string;
  viennaClasses: string;
  niceClasses: string;
  registeredFrom: string;
  expiresAt: string;
}

// Optional registered-trademark metadata — when present it is surfaced on the
// "About" page, footer, and contact page so the legal status of the brand is
// visible to customers.
//
// The demo brand ships WITHOUT a registered trademark: this is `undefined`, and
// TrademarkNotice + the landing/contact pages render nothing. Operators with a
// real registration populate the `TrademarkConfig` shape above.
export const trademark: TrademarkConfig | undefined = undefined;

// ---------------------------------------------------------------------------
// Seasonal sale
// ---------------------------------------------------------------------------

export const SPRING_SALE_END_ISO = '2026-05-28T23:59:59+03:00';
