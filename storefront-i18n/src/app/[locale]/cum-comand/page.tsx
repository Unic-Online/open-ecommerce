import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocaleKey } from '@/i18n/locales';
import styles from '@/components/InfoPage.module.css';
import { CumComandContent as CumComandContentRo } from '@/../content/pages/ro/cum-comand';
import { CumComandContent as CumComandContentEn } from '@/../content/pages/en/cum-comand';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: LocaleKey }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.seo.cumComand' });
  return { title: t('title'), description: t('description') };
}

const CONTENT: Record<LocaleKey, () => React.JSX.Element> = {
  ro: CumComandContentRo,
  en: CumComandContentEn,
};

export default async function HowToOrderPage({
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
