import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import HeroCarousel from '@/components/HeroCarousel';
import { getProduct } from '@/i18n/product';
import { getMarketConfig, getMarketForLocale, type MarketConfig } from '@/i18n/market-config';
import { getReviewsByLocale } from '@/data/reviews-registry';
import { summarizeReviews } from '@/lib/reviews';
import {
  type ProductCategory,
  type ProductTemplate,
  categoryToProductRoute,
} from '@/lib/product';
import { categories } from '@/site.config';
import { PRODUCTS } from '@/../content/products';
import { routing } from '@/i18n/routing';
import { TRADEMARK } from '@/lib/constants';
import { alternatesMetadata } from '@/lib/seo/alternates';
import ProductCard from '@/components/product-template/ProductCard';
import VideoReviews from '@/components/VideoReviews';
import styles from './page.module.css';

export const revalidate = 3600;

interface CategorySectionMeta {
  category: ProductCategory;
  slugs: readonly string[];
}

// One section per category, in registry order, listing that category's slugs.
const CATEGORY_SECTIONS: CategorySectionMeta[] = categories.map((cat) => ({
  category: cat.key,
  slugs: PRODUCTS.filter((p) => p.category === cat.key).map((p) => p.slug),
}));

function buildReviewStats(locale: LocaleKey): Record<string, { average: number; total: number }> {
  const stats: Record<string, { average: number; total: number }> = {};
  for (const p of PRODUCTS) {
    const reviews = getReviewsByLocale(p.slug, locale);
    if (reviews.length === 0) continue;
    const s = summarizeReviews(reviews);
    stats[p.slug] = { average: s.average, total: s.total };
  }
  return stats;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.home' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesMetadata('/', locale),
  };
}

// Only the static (non-dynamic) pathname keys can be passed as a plain
// string href to next-intl's Link. Dynamic ones like '/furniture/[slug]'
// require the object form `{pathname, params}`.
type AppPathname = Exclude<keyof typeof routing.pathnames, `${string}[${string}]${string}`>;

interface CategoryTile {
  key: ProductCategory;
  href?: AppPathname;
  image?: string;
  icon?: string;
  comingSoon?: boolean;
}

// One tile per category, in registry order. The tile image is the first
// gallery shot of the first product in that category.
const CATEGORY_TILES: CategoryTile[] = categories.map((cat) => {
  const first = PRODUCTS.find((p) => p.category === cat.key);
  const image = (first?.locales.en ?? first?.locales.ro)?.gallery[0]?.src;
  return {
    key: cat.key,
    href: categoryToProductRoute(cat.key) as AppPathname,
    image,
  };
});

interface TrustItem {
  icon: string;
  title: string;
  description: string;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}) {
  const { locale } = await params;
  const market = getMarketForLocale(locale);
  const marketConfig: MarketConfig = getMarketConfig(market);
  const t = await getTranslations({ locale, namespace: 'home' });
  const tSeo = await getTranslations({ locale, namespace: 'common.seo' });
  const reviewStats = buildReviewStats(locale);

  // Trade CTA — WhatsApp where a number is configured, mailto otherwise.
  const tradeWhatsapp = marketConfig.contact.whatsappNumber;
  const tradeEmail = marketConfig.contact.businessEmail;
  const tradeWaMessage = encodeURIComponent(t('trade.whatsappMessage'));
  const tradeMailSubject = encodeURIComponent(t('trade.emailSubject'));
  const tradeMailBody = encodeURIComponent(t('trade.emailBody'));
  const tradeHref = tradeWhatsapp
    ? `https://wa.me/${tradeWhatsapp}?text=${tradeWaMessage}`
    : `mailto:${tradeEmail}?subject=${tradeMailSubject}&body=${tradeMailBody}`;
  const tradeIsExternal = Boolean(tradeWhatsapp);

  // Resolve localized product templates (FR/RO) for each card.
  const sectionsWithProducts = await Promise.all(
    CATEGORY_SECTIONS.map(async (section) => {
      const products = (
        await Promise.all(
          section.slugs.map((slug) =>
            getProduct({ locale, market, category: section.category, slug }),
          ),
        )
      ).filter((p): p is ProductTemplate => p !== null);
      return { ...section, products };
    }),
  );

  const trustItems = t.raw('trust') as TrustItem[];

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>{tSeo('layout.title')}</h1>
      <HeroCarousel />

      <section className={styles.categoriesSection}>
        <div className={styles.categoriesGrid}>
          {CATEGORY_TILES.map((cat) => {
            const name = t(`categories.${cat.key}.name`);
            return cat.comingSoon ? (
              <div
                key={cat.key}
                className={`${styles.categoryTile} ${styles.categoryTileDisabled}`}
                aria-disabled="true"
              >
                <div className={styles.categoryImageWrap}>
                  <span className={styles.comingSoonPlaceholder} aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span className={styles.comingSoonBadge}>
                    {t('categories.comingSoonBadge')}
                  </span>
                </div>
                <div className={styles.categoryFooter}>
                  <span className={styles.categoryName}>{name}</span>
                </div>
              </div>
            ) : (
              <Link key={cat.key} href={cat.href!} className={styles.categoryTile}>
                <div className={styles.categoryImageWrap}>
                  <Image
                    src={cat.image!}
                    alt={name}
                    fill
                    sizes="(max-width: 600px) 45vw, 280px"
                    className={styles.categoryImage}
                  />
                  <span className={styles.springBadge}>
                    {t('categories.saleBadge')}
                  </span>
                </div>
                <div className={styles.categoryFooter}>
                  <span className={styles.categoryName}>{name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {sectionsWithProducts.map((section) => {
        if (section.products.length === 0) return null;
        const layoutClass =
          section.products.length > 1 ? styles.productGrid : styles.productListVertical;

        return (
          <section key={section.category} className={styles.productSection}>
            <span className={styles.sectionEyebrow}>
              {t(`sections.${section.category}.eyebrow`)}
            </span>
            <h2 className={styles.sectionTitle}>
              {t(`sections.${section.category}.title`)}
            </h2>
            <div className={layoutClass}>
              {section.products.map((product) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  reviewStats={reviewStats[product.slug]}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* ---------- Video Reviews ---------- */}
      <VideoReviews />

      {/* ---------- About Us mini-section ---------- */}
      <section className={styles.aboutSection} id="about-us-landing">
        <div className={styles.aboutInner}>
          <div className={styles.aboutContent}>
            <span className={styles.sectionEyebrow}>{t('about.eyebrow')}</span>
            <h2 className={styles.sectionTitle}>{t('about.title')}</h2>
            <p className={styles.aboutText}>{t('about.description')}</p>
            <div className={styles.aboutValues}>
              <div className={styles.aboutValue}>
                <span className={styles.aboutValueIcon} aria-hidden="true">🛟</span>
                <div>
                  <strong className={styles.aboutValueTitle}>{t('about.values.support.title')}</strong>
                  <span className={styles.aboutValueDesc}>{t('about.values.support.desc')}</span>
                </div>
              </div>
              <div className={styles.aboutValue}>
                <span className={styles.aboutValueIcon} aria-hidden="true">🎯</span>
                <div>
                  <strong className={styles.aboutValueTitle}>{t('about.values.quality.title')}</strong>
                  <span className={styles.aboutValueDesc}>{t('about.values.quality.desc')}</span>
                </div>
              </div>
              <div className={styles.aboutValue}>
                <span className={styles.aboutValueIcon} aria-hidden="true">❤️</span>
                <div>
                  <strong className={styles.aboutValueTitle}>{t('about.values.passion.title')}</strong>
                  <span className={styles.aboutValueDesc}>{t('about.values.passion.desc')}</span>
                </div>
              </div>
            </div>
            <Link href="/despre-noi" className={styles.aboutCta}>
              {t('about.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Trademark notice (subtle) — omitted when no registered mark ---------- */}
      {TRADEMARK ? (
        <section className={styles.trademarkSection} id="trademark-landing">
          <div className={styles.trademarkInner}>
            <div className={styles.trademarkBadge}>
              <span className={styles.trademarkIcon} aria-hidden="true">®</span>
              <div className={styles.trademarkInfo}>
                <span className={styles.trademarkLabel}>{t('trademark.label')}</span>
                <span className={styles.trademarkNumber}>
                  {TRADEMARK.trademarkNumber} · {t('trademark.validUntil')} {TRADEMARK.expiresAt}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- Return policy highlight ---------- */}
      <section className={styles.returnSection} id="return-policy-landing">
        <div className={styles.returnCard}>
          <div className={styles.returnIconWrap}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 10h10a5 5 0 010 10H9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 6L3 10l4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.returnContent}>
            <h3 className={styles.returnTitle}>{t('returnPolicy.title')}</h3>
            <p className={styles.returnDesc}>{t('returnPolicy.description')}</p>
          </div>
          <Link href="/politica-retur" className={styles.returnCta}>
            {t('returnPolicy.cta')}
          </Link>
        </div>
      </section>

      <section className={styles.refurbishedSection}>
        <div className={styles.refurbishedCard}>
          <span className={styles.refurbishedTag}>
            {t('trade.newPrefix')} {t('trade.tag')}
          </span>
          <h3 className={styles.refurbishedTitle}>{t('trade.title')}</h3>
          <p className={styles.refurbishedSub}>{t('trade.description')}</p>
          <a
            href={tradeHref}
            className={styles.refurbishedCta}
            {...(tradeIsExternal
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {t('trade.cta')}
          </a>
        </div>
      </section>

      <section className={styles.trustSection}>
        <ul className={styles.trustList}>
          {trustItems.map((item) => (
            <li key={item.title} className={styles.trustItem}>
              <span className={styles.trustIcon}>{item.icon}</span>
              <div className={styles.trustText}>
                <span className={styles.trustItemTitle}>{item.title}</span>
                <span className={styles.trustItemDesc}>{item.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
