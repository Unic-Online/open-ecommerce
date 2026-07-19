import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import styles from '@/components/InfoPage.module.css';
import { CumComandContent } from '@/../content/pages/cum-comand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.cumComand');
  return { title: t('title'), description: t('description') };
}

export default function HowToOrderPage() {
  return (
    <div className={styles.page}>
      <CumComandContent />
    </div>
  );
}
