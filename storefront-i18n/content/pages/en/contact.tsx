import infoStyles from '@/components/InfoPage.module.css';
import TrademarkNotice from '@/components/TrademarkNotice';
import ContactForm from '@/app/[locale]/contact/ContactForm';
import styles from '@/app/[locale]/contact/Contact.module.css';

interface ContactContentProps {
  businessEmail: string;
  whatsappDisplay: string;
}

export function ContactContent({ businessEmail, whatsappDisplay }: ContactContentProps) {
  return (
    <>
      <section className={infoStyles.hero}>
        <span className={infoStyles.eyebrow}>Contact</span>
        <h1 className={infoStyles.heroTitle}>Let&apos;s talk</h1>
        <p className={infoStyles.heroSub}>
          Send us a message! We respond quickly and to the point.
        </p>
      </section>

      <div className={styles.layout}>
        <ContactForm />

        <aside className={styles.infoStack}>
          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden="true">✉️</span>
            <h3 className={styles.infoTitle}>Email us</h3>
            <a href={`mailto:${businessEmail}`} className={styles.infoLink}>
              {businessEmail}
            </a>
            <p className={styles.infoText}>
              At any hour, any day, you&apos;re welcome to send us an email.
              We&apos;ll get back to you as soon as possible with a clear
              and precise response.
            </p>
          </div>

          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden="true">📞</span>
            <h3 className={styles.infoTitle}>Call us</h3>
            <a href={`tel:${whatsappDisplay.replace(/\s/g, '')}`} className={styles.infoLink}>
              {whatsappDisplay}
            </a>
            <p className={styles.infoText}>
              If you call between 14:00 and 17:00 local time and need
              assistance, don&apos;t hesitate — we&apos;ll be happy to help.
              Otherwise, we&apos;ll reply by email within 48 hours of receiving
              your message (working days).
              😀
            </p>
          </div>

          <TrademarkNotice variant="compact" />
        </aside>
      </div>
    </>
  );
}
