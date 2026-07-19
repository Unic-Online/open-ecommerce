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
        <h1 className={infoStyles.heroTitle}>Hai să discutăm</h1>
        <p className={infoStyles.heroSub}>
          Trimite-ne un mesaj! Revenim cu un răspuns prompt și la subiect.
        </p>
      </section>

      <div className={styles.layout}>
        <ContactForm />

        <aside className={styles.infoStack}>
          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden="true">✉️</span>
            <h3 className={styles.infoTitle}>Scrie-ne pe email</h3>
            <a href={`mailto:${businessEmail}`} className={styles.infoLink}>
              {businessEmail}
            </a>
            <p className={styles.infoText}>
              La orice oră, în orice zi ne poți trimite un email, iar noi, în cel mai scurt
              timp posibil, vom reveni cu un răspuns prompt și la subiect.
            </p>
          </div>

          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden="true">📞</span>
            <h3 className={styles.infoTitle}>Sună-ne</h3>
            <a href={`tel:${whatsappDisplay.replace(/\s/g, '')}`} className={styles.infoLink}>
              {whatsappDisplay}
            </a>
            <p className={styles.infoText}>
              Dacă e între 14 și 17 și ai nevoie de ajutorul nostru, nu ezita să ne suni — vom
              răspunde cu siguranță nevoilor tale! Dacă nu, revenim prin email în maxim 48 de
              ore de la primirea mesajului (în zilele lucrătoare). 😀
            </p>
          </div>

          <TrademarkNotice variant="compact" />
        </aside>
      </div>
    </>
  );
}
