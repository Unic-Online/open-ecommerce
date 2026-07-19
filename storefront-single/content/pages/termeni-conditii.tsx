import { Link } from '@/lib/nav';
import styles from '@/components/InfoPage.module.css';

interface TermeniConditiiContentProps {
  businessEmail: string;
}

export function TermeniConditiiContent({
  businessEmail,
}: TermeniConditiiContentProps) {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.heroTitle}>Terms &amp; Conditions</h1>
        <p className={styles.heroSub}>
          Terms of use of the site and purchase of products.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Site publisher</h2>
        <p>
          The Acme Store site (<a href="https://shop.example.com">shop.example.com</a>)
          is published and operated by{' '}
          <strong>Acme Store Demo SRL</strong>, with its registered office at
          1 Example Street, London, United Kingdom (registration no. 00000000) — replace with
          your own company details.
        </p>

        <h2>2. Purpose</h2>
        <p>
          These terms and conditions govern the use of the site and the cross-border sale
          of Acme Store products to customers based in the United Kingdom. Placing an order
          constitutes unconditional acceptance of these terms.
        </p>

        <h2>3. Orders and payment</h2>
        <p>
          Prices are shown in euros (EUR), inclusive of all applicable taxes.
          Payment is made by debit or credit card, Revolut Pay, Apple Pay, or Google Pay
          via our payment provider Revolut. An order is only confirmed once payment has
          been authorised.
        </p>

        <h2>4. Delivery</h2>
        <p>
          Standard delivery charges to the UK are €10 per order, waived on orders where
          the product subtotal reaches at least €300. Estimated delivery times are
          communicated at order confirmation. Delivery currently covers mainland UK only.
        </p>

        <h2>5. Right of withdrawal</h2>
        <p>
          In accordance with the Consumer Contracts (Information, Cancellation and
          Additional Charges) Regulations 2013, you have 14 calendar days from receipt
          of the product to exercise your right of withdrawal, without having to provide
          a reason. Details of the returns process are set out in the{' '}
          <Link href="/politica-retur">Returns Policy</Link>.
        </p>

        <h2>6. Warranties</h2>
        <p>
          All products benefit from the statutory implied terms as to satisfactory quality,
          fitness for purpose, and conformity with description under the Consumer Rights
          Act 2015, as well as protection against latent defects under applicable law.
        </p>

        <h2>7. Personal data</h2>
        <p>
          The processing of your personal data is described in the{' '}
          <Link href="/politica-confidentialitate">Privacy Policy</Link>,
          which complies with the UK General Data Protection Regulation (UK GDPR).
        </p>

        <h2>8. Applicable law</h2>
        <p>
          Any dispute will first be referred to mediation, then to the courts of competent
          jurisdiction.
        </p>

        <h2>Contact</h2>
        <p>
          For any enquiry, contact us at{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a> or via the{' '}
          <Link href="/contact">contact page</Link>.
        </p>
      </div>
    </>
  );
}
