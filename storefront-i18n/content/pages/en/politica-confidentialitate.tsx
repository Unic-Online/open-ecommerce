import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

interface PoliticaConfidentialitateContentProps {
  businessEmail: string;
}

export function PoliticaConfidentialitateContent({
  businessEmail,
}: PoliticaConfidentialitateContentProps) {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.heroTitle}>Privacy Policy</h1>
        <p className={styles.heroSub}>
          Personal data protection — our commitment to you.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Data controller</h2>
        <p>
          The controller responsible for processing your personal data is{' '}
          <strong>Acme Store Demo SRL</strong>, with its registered office at
          1 Example Street, London, United Kingdom, publisher of the Acme Store brand — replace
          with your own company details.
        </p>

        <h2>2. Data collected</h2>
        <p>
          We collect only the data necessary to process your order and manage the customer
          relationship: identity, delivery and billing address, email, phone number, order
          history, IP address, and technical information relating to your browsing
          (cookies). Payment is handled by Revolut; we do not store any card data.
        </p>

        <h2>3. Legal basis and purposes</h2>
        <ul>
          <li>
            <strong>Performance of a contract —</strong> order processing, delivery,
            and after-sales service.
          </li>
          <li>
            <strong>Legal obligation —</strong> accounting and tax record-keeping.
          </li>
          <li>
            <strong>Legitimate interest —</strong> site security and fraud prevention.
          </li>
          <li>
            <strong>Consent —</strong> marketing communications, analytical and advertising
            cookies (Meta Pixel, Google Analytics). You may withdraw your consent at any
            time via the cookie banner.
          </li>
        </ul>

        <h2>4. Recipients</h2>
        <p>
          Your data is shared only with our technical sub-processors:
          Revolut (payment), Resend (transactional email delivery), MongoDB Atlas
          (database hosting), Vercel (application hosting), Meta, and Google
          (analytics and advertising, subject to consent). We never sell your data.
        </p>

        <h2>5. Retention period</h2>
        <p>
          Order data is retained for the legally required period (10 years for accounting
          records). Abandoned baskets and marketing contacts are anonymised after 180 days
          of inactivity.
        </p>

        <h2>6. Your rights</h2>
        <p>
          In accordance with the UK GDPR and applicable data protection law, you have the
          right of access, rectification, erasure, restriction, portability, and objection.
          You may exercise these rights by writing to us at{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a>. You also have the right
          to lodge a complaint with the Information Commissioner&apos;s Office (ICO) at{' '}
          <a href="https://www.ico.org.uk">www.ico.org.uk</a>.
        </p>

        <h2>7. Transfers outside the UK/EEA</h2>
        <p>
          Data is not transferred outside the United Kingdom or European Economic Area
          beyond what is strictly necessary for the operation of our technical
          sub-processors, who provide the contractual safeguards required under the
          UK GDPR.
        </p>

        <h2>Data protection contact</h2>
        <p>
          For any question relating to the processing of your data, contact us at{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a> or via the{' '}
          <Link href="/contact">contact page</Link>.
        </p>
      </div>
    </>
  );
}
