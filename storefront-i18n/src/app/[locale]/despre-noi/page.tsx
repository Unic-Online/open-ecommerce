import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import styles from '@/components/InfoPage.module.css';
import { DespreNoiContent as DespreNoiContentRo } from '@/../content/pages/ro/despre-noi';
import { DespreNoiContent as DespreNoiContentEn } from '@/../content/pages/en/despre-noi';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.despreNoi' });
  return { title: t('title'), description: t('description') };
}

const CONTENT: Record<LocaleKey, () => React.JSX.Element> = {
  ro: DespreNoiContentRo,
  en: DespreNoiContentEn,
};

export default async function AboutPage({
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
