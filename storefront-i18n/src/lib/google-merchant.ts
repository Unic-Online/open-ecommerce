import { computeShippingCost } from '@/lib/pricing';
import { categoryToProductRoute, allCategoryKeys, type ProductTemplate } from '@/lib/product';
import { getMarketConfig, DEFAULT_MARKET, MARKETS, type MarketKey } from '@/i18n/market-config';
import { getCategoryProducts } from '@/i18n/product';

const PREORDER_LEAD_DAYS = 60;

// Compose products through the i18n layer so the feed shows the same copy
// (titles, descriptions, gallery) as the rendered product page for the
// market. Iterates the category registry so a new category appears in the
// feed automatically.
export function getMerchantProducts(market: MarketKey = DEFAULT_MARKET): ProductTemplate[] {
  const locale = MARKETS[market].locale;
  return allCategoryKeys().flatMap((category) =>
    getCategoryProducts({ locale, market, category }),
  );
}

export function generateGoogleMerchantFeed(
  products: ProductTemplate[] | undefined = undefined,
  now: Date = new Date(),
  market: MarketKey = DEFAULT_MARKET,
): string {
  const resolvedProducts = products ?? getMerchantProducts(market);
  const config = getMarketConfig(market);
  const items = resolvedProducts
    .map((product) => renderItem(product, now, config))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(config.name)}</title>
    <link>${xml(config.baseUrl)}</link>
    <description>${xml(`${config.name} product feed for Google Merchant Center`)}</description>
${items}
  </channel>
</rss>
`;
}

function renderItem(
  product: ProductTemplate,
  now: Date,
  config: ReturnType<typeof getMarketConfig>,
): string {
  const link = makeAbsoluteUrl(
    `${categoryToProductRoute(product.category)}/${product.slug}`,
    config.baseUrl,
  );
  const images = product.gallery.map((image) => makeAbsoluteUrl(image.src, config.baseUrl));
  const [mainImage, ...additionalImages] = images;
  const availability = getAvailability(product);
  const availabilityDate =
    availability === 'preorder' || availability === 'backorder'
      ? addDays(now, PREORDER_LEAD_DAYS).toISOString()
      : null;

  const price = product.oldPrice && product.oldPrice > product.price ? product.oldPrice : product.price;
  const salePrice = product.oldPrice && product.oldPrice > product.price ? product.price : null;
  const shippingCost = computeShippingCost(product.price, config.shipping);
  const targetCountry = config.googleMerchant?.targetCountry ?? config.shipping.defaultCountryCode;
  const currency = config.currency;

  return `    <item>
      <g:id>${xml(`${product.category}_${product.slug}`)}</g:id>
      <g:title>${xml(limit(product.fullTitle, 150))}</g:title>
      <g:description>${xml(limit(stripMarkdown(product.shortDescription), 5000))}</g:description>
      <g:link>${xml(link)}</g:link>
      <g:image_link>${xml(mainImage ?? link)}</g:image_link>${additionalImages
        .slice(0, 10)
        .map((image) => `\n      <g:additional_image_link>${xml(image)}</g:additional_image_link>`)
        .join('')}
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>${availabilityDate ? `\n      <g:availability_date>${availabilityDate}</g:availability_date>` : ''}
      <g:price>${formatMerchantPrice(price, currency)}</g:price>${salePrice ? `\n      <g:sale_price>${formatMerchantPrice(salePrice, currency)}</g:sale_price>` : ''}
      <g:brand>${xml(config.name)}</g:brand>
      <g:product_type>${xml(product.category)}</g:product_type>
      <g:shipping>
        <g:country>${targetCountry}</g:country>
        <g:service>Standard</g:service>
        <g:price>${formatMerchantPrice(shippingCost, currency)}</g:price>
      </g:shipping>
    </item>`;
}

function getAvailability(product: ProductTemplate): 'in_stock' | 'out_of_stock' | 'preorder' | 'backorder' {
  if (product.inStock) return 'in_stock';
  const text = `${product.preorderNotice ?? ''} ${product.availabilityNote ?? ''}`.toLowerCase();
  if (text.includes('precomand')) return 'preorder';
  return 'out_of_stock';
}

function makeAbsoluteUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

function formatMerchantPrice(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function stripMarkdown(value: string): string {
  return value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function limit(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max).trim();
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
