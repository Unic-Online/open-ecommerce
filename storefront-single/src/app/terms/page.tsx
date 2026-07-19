import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import { getMarketConfig } from '@/lib/market';
import styles from '@/components/InfoPage.module.css';
import { TermeniConditiiContent } from '@/../content/pages/termeni-conditii';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.termeniConditii');
  return { title: t('title'), description: t('description') };
}

export default function TermsPage() {
  const market = getMarketConfig();
  return (
    <div className={styles.page}>
      <TermeniConditiiContent businessEmail={market.contact.businessEmail} />
    </div>
  );
}
