/**
 * Locale-specific product copy. Pairs with `ProductBusiness` (in `./product.ts`)
 * to compose a full `ProductTemplate` at request time.
 *
 * Invariants:
 *   - `gallery[].src` is shared across locales except for text-bearing
 *     assets, where the FR variant uses a `-txt-fr.<ext>` suffix in place of
 *     the RO `-txt.<ext>` (see commit 39dc500). `gallery[].label` is always
 *     locale-specific (alt text + caption).
 *   - `breadcrumb[].href` should be the canonical (RO) category route. The
 *     i18n product loader rewrites these into localized paths via the
 *     routing pathnames map before returning the composed template.
 *   - `description` carries the entire descriptive body (paragraphs,
 *     headings, bullet lists, image captions, spec lists, PDFs).
 *   - `preorderNotice` and `availabilityNote` ARE locale-bearing and live
 *     here, not on the business stub.
 * Side effects: none (pure data).
 */
import type {
  ProductDescriptionSection,
  ProductBreadcrumbItem,
  ProductGalleryImage,
  ProductHelpContact,
} from './product';

export interface ProductContent {
  shortName: string;
  fullTitle: string;
  tagline: string;
  shortDescription: string;
  badge?: string;
  preorderNotice?: string;
  availabilityNote?: string;
  breadcrumb: ProductBreadcrumbItem[];
  categoryLink?: ProductBreadcrumbItem;
  gallery: ProductGalleryImage[];
  description: ProductDescriptionSection[];
  helpContact?: ProductHelpContact;
}
