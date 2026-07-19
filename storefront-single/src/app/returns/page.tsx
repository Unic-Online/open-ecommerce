import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import styles from '@/components/InfoPage.module.css';
import { PoliticaReturContent } from '@/../content/pages/politica-retur';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.politicaRetur');
  return { title: t('title'), description: t('description') };
}

export default function ReturnPolicyPage() {
  return (
    <div className={styles.page}>
      <PoliticaReturContent />
    </div>
  );
}
