import { useTranslations } from '@/lib/strings';
import { TRADEMARK } from '@/lib/constants';
import styles from './TrademarkNotice.module.css';

interface Props {
  variant?: 'full' | 'compact';
  className?: string;
}

export default function TrademarkNotice({ variant = 'full', className }: Props) {
  const t = useTranslations('common.trademark');

  // Trademark is optional — render nothing for a brand without a registered mark.
  if (!TRADEMARK) return null;

  if (variant === 'compact') {
    return (
      <p className={`${styles.compact} ${className ?? ''}`}>
        <span className={styles.markBadge} aria-hidden="true">®</span>
        <span>
          {t.rich('compact', {
            regNumber: TRADEMARK.registrationNumber,
            markNumber: TRADEMARK.trademarkNumber,
            expiresAt: TRADEMARK.expiresAt,
            holder: TRADEMARK.holder.name,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </span>
      </p>
    );
  }

  return (
    <section className={`${styles.section} ${className ?? ''}`} aria-labelledby="trademark-title">
      <header className={styles.header}>
        <span className={styles.markBadge} aria-hidden="true">®</span>
        <div>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h2 id="trademark-title" className={styles.title}>
            {t('title')}
          </h2>
        </div>
      </header>

      <p className={styles.intro}>
        {t.rich('intro', { strong: (chunks) => <strong>{chunks}</strong> })}
      </p>

      <dl className={styles.grid}>
        <div className={styles.row}>
          <dt>{t('labels.holder')}</dt>
          <dd>
            <strong>{TRADEMARK.holder.name}</strong>
            <br />
            {TRADEMARK.holder.address}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.representative')}</dt>
          <dd>
            <strong>{TRADEMARK.representative.name}</strong>
            <br />
            {TRADEMARK.representative.address}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.registrationNumber')}</dt>
          <dd>{TRADEMARK.registrationNumber}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.registrationDate')}</dt>
          <dd>{TRADEMARK.registrationDate}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.trademarkNumber')}</dt>
          <dd>{TRADEMARK.trademarkNumber}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.procedureCompleted')}</dt>
          <dd>{TRADEMARK.procedureCompleted}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.type')}</dt>
          <dd>{TRADEMARK.type}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.colors')}</dt>
          <dd>{TRADEMARK.colors}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.viennaClasses')}</dt>
          <dd>{TRADEMARK.viennaClasses}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.niceClasses')}</dt>
          <dd>{TRADEMARK.niceClasses}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.registeredFrom')}</dt>
          <dd>{TRADEMARK.registeredFrom}</dd>
        </div>
        <div className={styles.row}>
          <dt>{t('labels.expiresAt')}</dt>
          <dd>{TRADEMARK.expiresAt}</dd>
        </div>
      </dl>
    </section>
  );
}
