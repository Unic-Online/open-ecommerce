'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { useMarket } from '@/i18n/market-context';
import CookieSettingsLink from './CookieSettingsLink';
import NewsletterForm from './NewsletterForm';
import TrademarkNotice from './TrademarkNotice';
import { brand } from '@/site.config';
import styles from './Footer.module.css';

export default function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('navigation');
  const market = useMarket();
  const businessEmail = market.contact.businessEmail;
  const whatsappDisplay = market.contact.whatsappDisplay;
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          {/* Brand column */}
          <div className={styles.brand}>
            <Link href="/" className={styles.logoWrap} aria-label={tNav('logoAria')}>
              <Image
                src={brand.logo.footer}
                alt={brand.siteName}
                width={200}
                height={60}
                sizes="180px"
                className={styles.logoImg}
                priority={false}
              />
            </Link>
            <div className={styles.contact}>
              <a href={`mailto:${businessEmail}`}>{businessEmail}</a>
              {whatsappDisplay && (
                <a href={`tel:${whatsappDisplay.replace(/\s/g, '')}`}>{whatsappDisplay}</a>
              )}
            </div>
          </div>

          {/* Useful links */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>{t('usefulLinks')}</h4>
            <Link href="/" className={styles.link}>{t('links.home')}</Link>
            <Link href="/despre-noi" className={styles.link}>{t('links.despreNoi')}</Link>
            <Link href="/" className={styles.link}>{t('links.shop')}</Link>
            <a
              href="https://example.com/blog"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {t('links.blog')}
            </a>
            <Link href="/contact" className={styles.link}>{t('links.contact')}</Link>
          </div>

          {/* Legal */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>{t('legal')}</h4>
            <Link href="/termeni-conditii" className={styles.link}>{t('legalLinks.termsConditions')}</Link>
            <Link href="/politica-confidentialitate" className={styles.link}>{t('legalLinks.privacy')}</Link>
            <Link href="/politica-retur" className={styles.link}>{t('legalLinks.returns')}</Link>
            <Link href="/cum-comand" className={styles.link}>{t('legalLinks.howToOrder')}</Link>
            <Link href="/contact" className={styles.link}>{t('legalLinks.returnForm')}</Link>
          </div>

          {/* Newsletter */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>{t('newsletter')}</h4>
            <NewsletterForm />
          </div>

          {/* Trust badges / payments */}
          <div className={styles.badges}>
            <div className={styles.badgeRow}>
              <span className={styles.badgePill}>Revolut</span>
              <span className={styles.badgePill}>VISA</span>
              <span className={styles.badgePill}>Mastercard</span>
            </div>
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.badgeBlock}
            >
              <span>
                <span className={styles.badgeBlockTitle}>{t.rich('odrTitle', { br: () => <br /> })}</span>
                <span className={styles.badgeBlockSub}>{t('odrSub')}</span>
              </span>
            </a>
            <a
              href="https://anpc.ro/ce-este-sal/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.badgeBlock} ${styles.badgeAnpc}`}
            >
              <span>
                <span className={styles.badgeBlockTitle}>{t.rich('anpcTitle', { br: () => <br /> })}</span>
                <span className={styles.badgeBlockSub}>{t('anpcSub')}</span>
              </span>
            </a>
          </div>
        </div>

        <TrademarkNotice variant="compact" className={styles.trademark} />

        <div className={styles.bottom}>
          <p className={styles.copy}>
            {t.rich('copyright', { year, strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <CookieSettingsLink className={`${styles.link} ${styles.cookieLink}`} />
          <p className={styles.signature}>
            {t('signature')}
          </p>
        </div>
      </div>
    </footer>
  );
}
