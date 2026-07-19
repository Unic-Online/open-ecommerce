/**
 * Schema.org JSON-LD builders for SERP rich results.
 *
 * Invariants:
 *   - Every URL emitted is absolute (per schema.org best practice and Google's
 *     Rich Results Test). Use `MARKETS[market].baseUrl` for the host.
 *   - Builders return plain objects; the consumer renders them via
 *     `<JsonLd>` (`src/components/seo/JsonLd.tsx`). Do NOT stringify here —
 *     the React component handles serialization safely.
 *   - Schema is intentionally conservative: only fields with confident,
 *     accurate data. Empty/uncertain fields are omitted (Google warns on
 *     bad data, ignores missing fields).
 * Side effects: none (pure data shaping).
 */
import type { ProductTemplate } from '@/lib/product';
import type { ReviewSummary } from '@/lib/reviews';
import type { Review } from '@/data/reviews';
import type { MarketConfig } from '@/i18n/market-config';
import { MARKETS } from '@/i18n/market-config';

const ORG_NAME = 'Acme Store';
const ORG_LEGAL_NAME = 'Acme Store Demo SRL';

function logoUrl(market: MarketConfig): string {
  // Generic SVG wordmark shipped in `public/logo.svg`. Replace with your own
  // brand mark (and update `brand.logo` in site.config) when rebranding.
  return `${market.baseUrl}/logo.svg`;
}

export function organizationSchema(market: MarketConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${market.baseUrl}/#organization`,
    name: ORG_NAME,
    legalName: ORG_LEGAL_NAME,
    url: market.baseUrl,
    logo: logoUrl(market),
    email: market.contact.businessEmail,
    sameAs: [
      // Add social profiles here as they go live (Instagram, TikTok, FB).
    ],
    contactPoint: market.contact.whatsappNumber
      ? [
          {
            '@type': 'ContactPoint',
            telephone: `+${market.contact.whatsappNumber}`,
            contactType: 'customer support',
            availableLanguage: [market.languageTag],
          },
        ]
      : undefined,
  };
}

export function websiteSchema(market: MarketConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${market.baseUrl}/#website`,
    url: market.baseUrl,
    name: ORG_NAME,
    inLanguage: market.languageTag,
    publisher: { '@id': `${market.baseUrl}/#organization` },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbListSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface FaqSchemaItem {
  question: string;
  answer: string;
}

/**
 * FAQPage schema for the product's FAQ section. Returns null when there are no
 * items so the caller can skip emitting empty structured data. The answer is
 * stripped of `**bold**` markdown — schema.org wants plain text.
 */
export function faqPageSchema(items: FaqSchemaItem[]): Record<string, unknown> | null {
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.replace(/\*\*/g, ''),
      },
    })),
  };
}

export interface ProductSchemaInput {
  product: ProductTemplate;
  market: MarketConfig;
  url: string;
  reviewSummary?: ReviewSummary;
  reviews?: Review[];
}

export function productSchema({
  product,
  market,
  url,
  reviewSummary,
  reviews,
}: ProductSchemaInput): Record<string, unknown> {
  const images = product.gallery
    .map((g) => g.src)
    .filter(Boolean)
    .map((src) => (src.startsWith('http') ? src : `${market.baseUrl}${src}`));

  const sku = `${product.category}-${product.slug}`.toUpperCase();

  const offer = {
    '@type': 'Offer',
    url,
    priceCurrency: market.currency,
    price: product.price.toFixed(2),
    availability: product.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/PreOrder',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': `${market.baseUrl}/#organization` },
    // priceValidUntil is required for many price-based rich results; default
    // to one year out so the listing stays fresh between catalog edits.
    priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  };

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.fullTitle || product.shortName,
    description: product.shortDescription,
    sku,
    mpn: product.slug,
    brand: { '@type': 'Brand', name: ORG_NAME },
    image: images,
    url,
    offers: offer,
  };

  if (reviewSummary && reviewSummary.total > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewSummary.average.toFixed(1),
      reviewCount: reviewSummary.total,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews && reviews.length > 0) {
    // Cap at 10 reviews to keep payload small; Google only needs a sample.
    schema.review = reviews.slice(0, 10).map((r) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: r.name },
      datePublished: r.date,
      reviewBody: r.text,
      ...(r.title ? { name: r.title } : {}),
    }));
  }

  return schema;
}

/** Convenience: pick the right MarketConfig from a market key. */
export function getMarket(marketKey: 'ro' | 'english'): MarketConfig {
  return MARKETS[marketKey];
}
