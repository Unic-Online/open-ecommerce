import { categories, type ProductCategory } from '@/site.config';

export type { ProductCategory };

// Cart product-type id IS the category key. The catalog/prices key format is
// `${cartType}__${slug}` (see src/data/products/catalog.ts, prices.ts).
export type CartProductType = ProductCategory;

const CATEGORY_KEYS = categories.map((c) => c.key) as ProductCategory[];

/** Cart type id for a category — identity, since the key IS the cart type. */
export function categoryToCartType(category: ProductCategory): CartProductType {
  return category;
}

/**
 * Listing route for a category, e.g. `/furniture`. Used by the Google Merchant
 * feed and product links where the absolute link is built from the category
 * path on the market host.
 */
export function categoryToProductRoute(category: ProductCategory): string {
  const entry = categories.find((c) => c.key === category);
  return entry ? entry.pathname : `/${category}`;
}

// Typed pathname literal for the dynamic product route in each category.
// Used with the `hrefFor({ pathname, params })` helper to build the product
// URL. The pathname is the category path + `/[slug]`.
export type ProductDetailPathname = `${string}/[slug]`;

export function categoryToProductPathname(category: ProductCategory): ProductDetailPathname {
  return `${categoryToProductRoute(category)}/[slug]` as ProductDetailPathname;
}

/** All category keys, in registry order. */
export function allCategoryKeys(): ProductCategory[] {
  return [...CATEGORY_KEYS];
}

export interface ProductBreadcrumbItem {
  label: string;
  href?: string;
}

export interface ProductGalleryImage {
  src: string;
  label: string;
  aspect?: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductBulletItem {
  title: string;
  description: string;
}

export interface ProductFaqItem {
  question: string;
  answer: string;
}

export interface ProductImagePayload {
  src?: string;
  label: string;
  aspect?: string;
  priority?: boolean;
}

export type ProductDescriptionSection =
  | { kind: 'paragraph'; lead?: boolean; body: string }
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'bulletList'; items: ProductBulletItem[] }
  | { kind: 'faqList'; items: ProductFaqItem[] }
  | { kind: 'miniList'; items: string[] }
  | { kind: 'specList'; specs: ProductSpec[] }
  | { kind: 'image'; image: ProductImagePayload }
  | {
      kind: 'pdfDownload';
      href: string;
      title: string;
      subtitle: string;
    };

export interface ProductHelpContact {
  name: string;
  avatar: string;
  phone: string;
  email: string;
  intro?: string;
}

export interface ProductTemplate {
  slug: string;
  category: ProductCategory;
  shortName: string;
  fullTitle: string;
  tagline: string;
  shortDescription: string;
  price: number;
  oldPrice?: number;
  currency: 'EUR';
  inStock: boolean;
  preorderNotice?: string;
  availabilityNote?: string;
  // Composed-only fields — set by `composeProduct()` from i18n content.
  badge?: string;
  breadcrumb?: ProductBreadcrumbItem[];
  categoryLink?: ProductBreadcrumbItem;
  shareUrl?: string;
  gallery: ProductGalleryImage[];
  description?: ProductDescriptionSection[];
  helpContact?: ProductHelpContact;
  reviewsKey?: string;
  // Recommendation overrides — all optional.
  upsellSlug?: string;
  crossSellSlugs?: string[];
  popularSlugs?: string[];
}

/**
 * Business-only product record — the per-locale content lives in the unified
 * product file (`content/products/<slug>.ts`) and is composed with this stub
 * at request time by `src/i18n/product.ts`.
 *
 * Invariants:
 *   - `price`, `oldPrice`, `currency` are the single-market values. The
 *     server-trusted price also goes through `getMarketPrice` in
 *     `src/data/products/prices.ts` (which projects this same value).
 *   - `inStock` is the single boolean stock flag.
 */
export interface ProductBusiness {
  slug: string;
  category: ProductCategory;
  price: number;
  oldPrice?: number;
  currency: 'EUR';
  inStock: boolean;
  reviewsKey?: string;
  upsellSlug?: string;
  crossSellSlugs?: string[];
  popularSlugs?: string[];
}

const DIMENSION_LABEL_PRIORITY = [
  'Dimensions',
  'Dimensiuni',
  'Dimensiuni complete',
  'Overall dimensions',
];

const WEIGHT_LABELS = ['Greutate', 'Weight'];

function getProductSpecs(product: ProductTemplate): ProductSpec[] {
  return (product.description ?? []).flatMap((section) =>
    section.kind === 'specList' ? section.specs : [],
  );
}

export function getProductPrimaryDimension(product: ProductTemplate): ProductSpec | null {
  const specs = getProductSpecs(product);

  for (const label of DIMENSION_LABEL_PRIORITY) {
    const match = specs.find((spec) => spec.label.toLowerCase() === label.toLowerCase());
    if (match) return match;
  }

  return specs.find((spec) => spec.label.toLowerCase().includes('dimensi')) ?? null;
}

export function getProductWeight(product: ProductTemplate): ProductSpec | null {
  const specs = getProductSpecs(product);

  for (const label of WEIGHT_LABELS) {
    const match = specs.find((spec) => spec.label.toLowerCase() === label.toLowerCase());
    if (match) return match;
  }

  return null;
}
