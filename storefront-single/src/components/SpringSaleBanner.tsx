import Countdown from '@/components/Countdown';
import { SPRING_SALE_END_ISO } from '@/lib/constants';
import styles from './SpringSaleBanner.module.css';

// Seasonal sale banner with a live countdown to SPRING_SALE_END_ISO.
// Currently unplugged from the homepage — re-mount in `page.tsx` to re-enable.
export default function SpringSaleBanner({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <section className={styles.springBanner}>
      <div className={styles.springInner}>
        <h2 className={styles.springTitle}>{title}</h2>
        <p className={styles.springSub}>{subtitle}</p>
        <Countdown targetDate={SPRING_SALE_END_ISO} />
      </div>
    </section>
  );
}
