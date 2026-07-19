import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import { getMarketConfig, getMarketForLocale } from '@/i18n/market-config';
import styles from '@/components/InfoPage.module.css';
import { PoliticaConfidentialitateContent as PoliticaConfidentialitateContentRo } from '@/../content/pages/ro/politica-confidentialitate';
import { PoliticaConfidentialitateContent as PoliticaConfidentialitateContentEn } from '@/../content/pages/en/politica-confidentialitate';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.politicaConfidentialitate' });
  return { title: t('title'), description: t('description') };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}) {
  const { locale } = await params;
  const market = getMarketConfig(getMarketForLocale(locale));
  return (
    <div className={styles.page}>
      {locale === 'ro' ? (
        <PoliticaConfidentialitateContentRo
          businessEmail={market.contact.businessEmail}
          siteUrl={market.baseUrl}
        />
      ) : (
        <PoliticaConfidentialitateContentEn businessEmail={market.contact.businessEmail} />
      )}
    </div>
  );
}
