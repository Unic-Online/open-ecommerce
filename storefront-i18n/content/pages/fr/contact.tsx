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
        <h1 className={infoStyles.heroTitle}>Discutons ensemble</h1>
        <p className={infoStyles.heroSub}>
          Envoyez-nous un message ! Nous répondons rapidement et au plus juste.
        </p>
      </section>

      <div className={styles.layout}>
        <ContactForm />

        <aside className={styles.infoStack}>
          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden="true">✉️</span>
            <h3 className={styles.infoTitle}>Écrivez-nous par email</h3>
            <a href={`mailto:${businessEmail}`} className={styles.infoLink}>
              {businessEmail}
            </a>
            <p className={styles.infoText}>
              À toute heure, n&apos;importe quel jour, vous pouvez nous envoyer un email.
              Nous revenons vers vous dans les plus brefs délais avec une réponse claire
              et précise.
            </p>
          </div>

          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden="true">📞</span>
            <h3 className={styles.infoTitle}>Appelez-nous</h3>
            <a href={`tel:${whatsappDisplay.replace(/\s/g, '')}`} className={styles.infoLink}>
              {whatsappDisplay}
            </a>
            <p className={styles.infoText}>
              Si vous appelez entre 14 h et 17 h (heure d&apos;Europe centrale) et avez
              besoin d&apos;aide, n&apos;hésitez pas — nous serons ravis de vous répondre.
              Sinon, nous revenons par email sous 48 h après réception du message
              (jours ouvrés).
              😀
            </p>
          </div>

          <TrademarkNotice variant="compact" />
        </aside>
      </div>
    </>
  );
}
