import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import styles from '@/components/InfoPage.module.css';
import { PoliticaReturContent as PoliticaReturContentRo } from '@/../content/pages/ro/politica-retur';
import { PoliticaReturContent as PoliticaReturContentEn } from '@/../content/pages/en/politica-retur';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.politicaRetur' });
  return { title: t('title'), description: t('description') };
}

const CONTENT: Record<LocaleKey, () => React.JSX.Element> = {
  ro: PoliticaReturContentRo,
  en: PoliticaReturContentEn,
};

export default async function ReturnPolicyPage({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}) {
  const { locale } = await params;
  const Content = CONTENT[locale];
  return (
    <div className={styles.page}>
      <Content />
    </div>
  );
}
