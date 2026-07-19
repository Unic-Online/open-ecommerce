import type { Metadata } from 'next';
import { getTranslations } from '@/lib/strings';
import styles from '@/components/InfoPage.module.css';
import { DespreNoiContent } from '@/../content/pages/despre-noi';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.seo.despreNoi');
  return { title: t('title'), description: t('description') };
}

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <DespreNoiContent />
    </div>
  );
}
