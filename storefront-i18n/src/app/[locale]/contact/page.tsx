import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import { getMarketConfig, getMarketForLocale } from '@/i18n/market-config';
import infoStyles from '@/components/InfoPage.module.css';
import { ContactContent as ContactContentRo } from '@/../content/pages/ro/contact';
import { ContactContent as ContactContentFr } from '@/../content/pages/fr/contact';
import { ContactContent as ContactContentEn } from '@/../content/pages/en/contact';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.contact' });
  return { title: t('title'), description: t('description') };
}

const CONTENT = {
  ro: ContactContentRo,
  fr: ContactContentFr,
  en: ContactContentEn,
} as const;

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}) {
  const { locale } = await params;
  const market = getMarketConfig(getMarketForLocale(locale));
  const Content = CONTENT[locale];
  return (
    <div className={infoStyles.page}>
      <Content
        businessEmail={market.contact.businessEmail}
        whatsappDisplay={market.contact.whatsappDisplay}
      />
    </div>
  );
}
