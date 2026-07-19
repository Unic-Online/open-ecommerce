import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import { getMarketConfig } from '@/lib/market';
import styles from '@/components/InfoPage.module.css';
import { PoliticaConfidentialitateContent } from '@/../content/pages/politica-confidentialitate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.politicaConfidentialitate');
  return { title: t('title'), description: t('description') };
}

export default function PrivacyPage() {
  const market = getMarketConfig();
  return (
    <div className={styles.page}>
      <PoliticaConfidentialitateContent businessEmail={market.contact.businessEmail} />
    </div>
  );
}
