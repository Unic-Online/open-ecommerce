import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import { getMarketConfig, getMarketForLocale } from '@/i18n/market-config';
import styles from '@/components/InfoPage.module.css';
import { TermeniConditiiContent as TermeniConditiiContentRo } from '@/../content/pages/ro/termeni-conditii';
import { TermeniConditiiContent as TermeniConditiiContentEn } from '@/../content/pages/en/termeni-conditii';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.termeniConditii' });
  return { title: t('title'), description: t('description') };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}) {
  const { locale } = await params;
  const market = getMarketConfig(getMarketForLocale(locale));
  return (
    <div className={styles.page}>
      {locale === 'ro' ? (
        <TermeniConditiiContentRo
          businessEmail={market.contact.businessEmail}
          siteUrl={market.baseUrl}
        />
      ) : (
        <TermeniConditiiContentEn businessEmail={market.contact.businessEmail} />
      )}
    </div>
  );
}
