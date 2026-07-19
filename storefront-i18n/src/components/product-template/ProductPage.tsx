import { getLocale, getTranslations } from 'next-intl/server';
import type { ProductTemplate } from '@/lib/product';
import type { LocaleKey } from '@/i18n/locales';
import type { Review } from '@/data/reviews';
import { summarizeReviews } from '@/lib/reviews';
import { getReviewsByLocale } from '@/data/reviews-registry';
import {
  getCrossSellForLocale,
  getPopularForLocale,
  getUpsellForLocale,
} from '@/i18n/product';
import { getMarketConfig, getMarketForLocale } from '@/i18n/market-config';
import {
  breadcrumbListSchema,
  faqPageSchema,
  productSchema,
  type BreadcrumbItem,
} from '@/lib/seo/structured-data';
import { getProductWeight } from '@/lib/product';
import { Link } from '@/i18n/navigation';
import type { ComponentProps } from 'react';
import JsonLd from '@/components/seo/JsonLd';

// Breadcrumb hrefs come from content data (always a routing pathname);
// next-intl's Link is strictly typed against routing keys.
type LinkHref = ComponentProps<typeof Link>['href'];
import ReviewSection from '@/components/reviews/ReviewSection';
import TikTokEmbed from '@/components/TikTokEmbed';
import ProductGallery from './ProductGallery';
import ProductBuyBox from './ProductBuyBox';
import ProductDescription from './ProductDescription';
import ProductFaq from './ProductFaq';
import FloatingCartBar from './FloatingCartBar';
import UpsellCard from './UpsellCard';
import RelatedProductsGrid from './RelatedProductsGrid';
import type { ProductReviewStats } from './ProductCard';
import styles from './product.module.css';

interface Props {
  product: ProductTemplate;
  reviews?: Review[];
  reviewsSummary?: string;
  tiktokVideoIds?: string[];
}

export default async function ProductPage({ product, reviews, reviewsSummary, tiktokVideoIds }: Props) {
  const locale = (await getLocale()) as LocaleKey;
  const t = await getTranslations({ locale, namespace: 'product.page' });
  const reviewSummary = reviews && reviews.length > 0 ? summarizeReviews(reviews) : undefined;
  const market = getMarketForLocale(locale);
  const marketConfig = getMarketConfig(market);
  const upsell = getUpsellForLocale({ product, locale, market });
  const crossSell = getCrossSellForLocale({ product, locale, market });
  const popular = getPopularForLocale({ product, locale, market });
  const galleryWeight = getProductWeight(product);

  const categoryLabels = {
    furniture: t('categoryShort.furniture'),
    lighting: t('categoryShort.lighting'),
    outdoor: t('categoryShort.outdoor'),
  };

  const relatedReviewStats: Record<string, ProductReviewStats> = {};
  for (const p of [...crossSell, ...popular]) {
    const r = getReviewsByLocale(p.slug, locale);
    if (r.length === 0) continue;
    const s = summarizeReviews(r);
    relatedReviewStats[p.slug] = { average: s.average, total: s.total };
  }

  // Absolute URL for the active market — used for both schemas.
  const productUrl = product.shareUrl ?? marketConfig.baseUrl;
  const productLd = productSchema({
    product,
    market: marketConfig,
    url: productUrl,
    reviewSummary,
    reviews,
  });
  const breadcrumbItems: BreadcrumbItem[] = (product.breadcrumb ?? []).map((b) => ({
    name: b.label,
    url: b.href ? `${marketConfig.baseUrl}${b.href}` : productUrl,
  }));
  const breadcrumbLd = breadcrumbListSchema(breadcrumbItems);

  // Collect FAQ items from the description so search engines get FAQPage rich
  // results; the visible UI renders the same data via ProductDescription.
  const faqItems = (product.description ?? []).flatMap((section) =>
    section.kind === 'faqList' ? section.items : [],
  );
  const faqLd = faqPageSchema(faqItems);

  return (
    <>
    <JsonLd data={faqLd ? [productLd, breadcrumbLd, faqLd] : [productLd, breadcrumbLd]} />
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label={t('breadcrumbAria')}>
        {(product.breadcrumb ?? []).map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {i > 0 && (
              <span className={styles.breadcrumbSep} aria-hidden="true">
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href as LinkHref} className={styles.breadcrumbLink}>
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      <section className={styles.top}>
        <ProductGallery images={product.gallery} slug={product.slug} weightSpec={galleryWeight} />
        <ProductBuyBox product={product} reviewSummary={reviewSummary} />
      </section>

      {upsell && <UpsellCard upsell={upsell} current={product} />}

      {tiktokVideoIds && tiktokVideoIds.length > 0 && (
        <section className={styles.tiktokSection} id="recenzii-video">
          <h2 className={styles.descHeading}>{t('headings.videoReviews')}</h2>
          <div className={styles.tiktokGrid}>
            {tiktokVideoIds.map((id) => (
              <TikTokEmbed key={id} videoId={id} />
            ))}
          </div>
        </section>
      )}

      {product.description && (
        <section className={styles.descSection}>
          <h2 className={styles.descHeading}>{t('headings.description')}</h2>
          <ProductDescription sections={product.description} />
        </section>
      )}

      {faqItems.length > 0 && (
        <section className={styles.descSection} id="intrebari-frecvente">
          <h2 className={styles.descHeading}>{t('headings.faq')}</h2>
          <ProductFaq items={faqItems} />
        </section>
      )}

      <RelatedProductsGrid
        title={t('headings.crossSell')}
        products={crossSell}
        categoryLabels={categoryLabels}
        reviewStats={relatedReviewStats}
      />
      <RelatedProductsGrid
        title={t('headings.popular')}
        products={popular}
        showCategoryLabel
        categoryLabels={categoryLabels}
        reviewStats={relatedReviewStats}
      />

      <section className={styles.reviewsSection} id="recenzii">
        <h2 className={styles.descHeading}>{t('headings.customerReviews')}</h2>
        <ReviewSection
          reviews={reviews ?? []}
          summaryText={reviewsSummary}
          productSlug={product.slug}
        />
      </section>
    </main>
    <FloatingCartBar product={product} />
    </>
  );
}
