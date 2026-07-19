/**
 * Unified product schema — one file per product at `content/products/<slug>.ts`.
 *
 * `defineProduct()` Zod-validates the literal at module load and returns a
 * frozen `DefinedProduct`. Everything the storefront needs about a product —
 * business flags, per-market prices, per-locale content, embedded reviews —
 * lives in that single object. The legacy split between `src/data/<cat>/<slug>`
 * (business stub) and `content/products/<locale>/<cat>/<slug>` (locale content)
 * is folded into this one schema.
 *
 * Adapters in `src/i18n/product.ts`, `src/data/products/{catalog,prices}.ts`,
 * `src/lib/product-search-index.ts`, and the reviews registry read DefinedProduct
 * fields and project them into the existing `ProductTemplate` / `ProductBusiness`
 * / `ProductMarketPrice` shapes — so downstream consumers don't change.
 *
 * Invariants:
 *   - A locale missing from `locales` means the product is HIDDEN on that
 *     market (mirrors the old "no content module ⇒ not rendered" rule).
 *   - `business.prices` is the source of truth the server charges. Keys are
 *     market keys ('ro' | 'english'); a missing market ⇒ unpurchasable there.
 *   - `category` MUST be a registered category key (`site.config.categories`).
 * Side effects: validation throws at import time with the offending slug.
 */
import { z } from 'zod';
import { categories } from '@/site.config';
import type { LocaleKey, MarketKey, ProductCategory } from '@/site.config';
import type { ProductContent } from './product-content';
import type { ProductBusiness, ProductTemplate } from './product';
import type { Review } from '@/data/reviews';

const CATEGORY_KEYS = categories.map((c) => c.key) as [string, ...string[]];

const breadcrumbItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().optional(),
});

const galleryImageSchema = z.object({
  src: z.string().min(1),
  label: z.string(),
  aspect: z.string().optional(),
});

const specSchema = z.object({ label: z.string(), value: z.string() });
const bulletItemSchema = z.object({ title: z.string(), description: z.string() });
const faqItemSchema = z.object({ question: z.string(), answer: z.string() });
const imagePayloadSchema = z.object({
  src: z.string().optional(),
  label: z.string(),
  aspect: z.string().optional(),
  priority: z.boolean().optional(),
});

const descriptionSectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), lead: z.boolean().optional(), body: z.string() }),
  z.object({ kind: z.literal('heading'), text: z.string() }),
  z.object({ kind: z.literal('subheading'), text: z.string() }),
  z.object({ kind: z.literal('bulletList'), items: z.array(bulletItemSchema) }),
  z.object({ kind: z.literal('faqList'), items: z.array(faqItemSchema) }),
  z.object({ kind: z.literal('miniList'), items: z.array(z.string()) }),
  z.object({ kind: z.literal('specList'), specs: z.array(specSchema) }),
  z.object({ kind: z.literal('image'), image: imagePayloadSchema }),
  z.object({
    kind: z.literal('pdfDownload'),
    href: z.string(),
    title: z.string(),
    subtitle: z.string(),
  }),
]);

const helpContactSchema = z.object({
  name: z.string(),
  avatar: z.string(),
  phone: z.string(),
  email: z.string(),
  intro: z.string().optional(),
});

const reviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  title: z.string(),
  text: z.string(),
  date: z.string(),
  product: z.string(),
  variant: z
    .object({
      color: z.string().optional(),
      size: z.string().optional(),
      quantity: z.string().optional(),
    })
    .optional(),
  verifiedPurchase: z.boolean().optional(),
  photos: z
    .array(
      z.object({ src: z.string(), alt: z.string(), width: z.number(), height: z.number() }),
    )
    .optional(),
  helpfulCount: z.number().optional(),
  topics: z.array(z.string()).optional(),
});

const localeContentSchema = z.object({
  shortName: z.string().min(1),
  fullTitle: z.string().min(1),
  tagline: z.string(),
  shortDescription: z.string(),
  badge: z.string().optional(),
  preorderNotice: z.string().optional(),
  availabilityNote: z.string().optional(),
  breadcrumb: z.array(breadcrumbItemSchema).min(1),
  categoryLink: breadcrumbItemSchema.optional(),
  gallery: z.array(galleryImageSchema).min(1),
  description: z.array(descriptionSectionSchema),
  helpContact: helpContactSchema.optional(),
  reviews: z.array(reviewSchema).optional(),
});

const marketPriceSchema = z.object({
  price: z.number().nonnegative(),
  oldPrice: z.number().nonnegative().optional(),
  currency: z.enum(['RON', 'EUR']),
});

const productSchema = z.object({
  slug: z.string().min(1),
  category: z.enum(CATEGORY_KEYS),
  business: z.object({
    inStock: z.boolean(),
    reviewsKey: z.string().optional(),
    upsellSlug: z.string().optional(),
    crossSellSlugs: z.array(z.string()).optional(),
    popularSlugs: z.array(z.string()).optional(),
    prices: z.object({
      ro: marketPriceSchema.nullable().optional(),
      english: marketPriceSchema.nullable().optional(),
    }),
  }),
  locales: z
    .object({
      en: localeContentSchema.optional(),
      ro: localeContentSchema.optional(),
    })
    .refine((l) => l.en || l.ro, { message: 'at least one locale must be present' }),
});

export type LocaleProductContent = z.infer<typeof localeContentSchema>;
export type ProductMarketPriceInput = z.infer<typeof marketPriceSchema>;
export type ProductInput = z.input<typeof productSchema>;

export interface DefinedProduct {
  slug: string;
  category: ProductCategory;
  business: {
    inStock: boolean;
    reviewsKey?: string;
    upsellSlug?: string;
    crossSellSlugs?: string[];
    popularSlugs?: string[];
    prices: Partial<Record<MarketKey, ProductMarketPriceInput | null>>;
  };
  locales: Partial<Record<LocaleKey, LocaleProductContent>>;
}

/**
 * Validate + freeze a product definition. Throws at import time with the slug
 * baked into the message so a malformed product fails the build loudly.
 */
export function defineProduct(input: ProductInput): DefinedProduct {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const slug = typeof input?.slug === 'string' ? input.slug : '<unknown>';
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid product "${slug}": ${issues}`);
  }
  return parsed.data as DefinedProduct;
}

// ---------------------------------------------------------------------------
// Projections — DefinedProduct → legacy shapes used across the app
// ---------------------------------------------------------------------------

/** RON business price used as the display fallback on the legacy stub. */
function fallbackPrice(p: DefinedProduct): { price: number; oldPrice?: number } {
  const ro = p.business.prices.ro;
  const en = p.business.prices.english;
  const src = ro ?? en;
  return { price: src?.price ?? 0, oldPrice: src?.oldPrice };
}

export function toBusiness(p: DefinedProduct): ProductBusiness {
  const { price, oldPrice } = fallbackPrice(p);
  return {
    slug: p.slug,
    category: p.category,
    price,
    oldPrice,
    currency: 'lei',
    inStock: p.business.inStock,
    reviewsKey: p.business.reviewsKey,
    upsellSlug: p.business.upsellSlug,
    crossSellSlugs: p.business.crossSellSlugs,
    popularSlugs: p.business.popularSlugs,
  };
}

/** Build a legacy `ProductTemplate`-shaped stub (business + RO fallback copy). */
export function toTemplateStub(p: DefinedProduct): ProductTemplate {
  const { price, oldPrice } = fallbackPrice(p);
  const content = p.locales.ro ?? p.locales.en!;
  return {
    slug: p.slug,
    category: p.category,
    shortName: content.shortName,
    fullTitle: content.fullTitle,
    tagline: content.tagline,
    shortDescription: content.shortDescription,
    price,
    oldPrice,
    currency: 'lei',
    inStock: p.business.inStock,
    preorderNotice: content.preorderNotice,
    availabilityNote: content.availabilityNote,
    gallery: content.gallery,
    reviewsKey: p.business.reviewsKey,
    upsellSlug: p.business.upsellSlug,
    crossSellSlugs: p.business.crossSellSlugs,
    popularSlugs: p.business.popularSlugs,
  };
}

export function toContent(p: DefinedProduct, locale: LocaleKey): ProductContent | null {
  const c = p.locales[locale];
  if (!c) return null;
  return {
    shortName: c.shortName,
    fullTitle: c.fullTitle,
    tagline: c.tagline,
    shortDescription: c.shortDescription,
    badge: c.badge,
    preorderNotice: c.preorderNotice,
    availabilityNote: c.availabilityNote,
    breadcrumb: c.breadcrumb,
    categoryLink: c.categoryLink,
    gallery: c.gallery,
    description: c.description,
    helpContact: c.helpContact,
  };
}

export function getProductReviews(p: DefinedProduct, locale: LocaleKey): Review[] {
  return (p.locales[locale]?.reviews ?? []) as Review[];
}
