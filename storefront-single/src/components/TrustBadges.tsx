import Image from 'next/image';
import { useTranslations } from '@/lib/strings';
import styles from './TrustBadges.module.css';

export default function TrustBadges() {
  const t = useTranslations('badges');

  const badges = [
    { src: '/badges/14-zile-retur-txt-en.png', alt: t('retur14Zile') },
    { src: '/badges/plata-securizata-txt-en.png', alt: t('plataSecurizata') },
    { src: '/badges/livrare-rapida-txt-en.png', alt: t('livrareRapida') },
  ];

  return (
    <ul className={styles.row} aria-label={t('ariaTitle')}>
      {badges.map((b) => (
        <li key={b.src} className={styles.item}>
          <Image
            src={b.src}
            alt={b.alt}
            width={96}
            height={96}
            className={styles.image}
            unoptimized
          />
        </li>
      ))}
    </ul>
  );
}
