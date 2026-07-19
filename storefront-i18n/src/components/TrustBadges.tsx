import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { getAsset } from '@/i18n/localized-assets';
import type { LocaleKey } from '@/i18n/locales';
import styles from './TrustBadges.module.css';

export default function TrustBadges() {
  const locale = useLocale() as LocaleKey;
  const t = useTranslations('badges');

  const badges = [
    { src: getAsset('badge14ZileRetur', locale), alt: t('retur14Zile') },
    { src: getAsset('badgePlataSecurizata', locale), alt: t('plataSecurizata') },
    { src: getAsset('badgeLivrareRapida', locale), alt: t('livrareRapida') },
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
