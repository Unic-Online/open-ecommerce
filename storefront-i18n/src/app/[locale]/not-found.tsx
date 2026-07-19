import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { categories } from '@/site.config';
import { categoryToProductRoute } from '@/lib/product';
import styles from './not-found.module.css';

export default async function NotFound() {
  const t = await getTranslations('common.notFound');

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.code} aria-hidden>
          {t('code')}
        </p>
        <h1 className={styles.heading}>{t('heading')}</h1>
        <p className={styles.body}>{t('body')}</p>

        <Link href="/" className={styles.cta}>
          {t('ctaHome')}
        </Link>

        <div className={styles.explore}>
          <p className={styles.exploreLabel}>{t('exploreLabel')}</p>
          <ul className={styles.categoryList}>
            {categories.map((cat) => (
              <li key={cat.key}>
                <Link
                  href={categoryToProductRoute(cat.key) as '/'}
                  className={styles.categoryLink}
                >
                  {t(`categories.${cat.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
