import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

export function PoliticaReturContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.heroTitle}>Returns Policy</h1>
        <p className={styles.heroSub}>
          14 days to change your mind — no penalties and no questions asked.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Right of withdrawal</h2>
        <p>
          The Buyer has the right to return products purchased on the site, without
          penalty and without giving a reason, within{' '}
          <strong>14 calendar days</strong> from the date of receipt of the products.
        </p>

        <h2>2. Return postage costs</h2>
        <p>
          In all return cases, the cost of return postage is borne by the Buyer.
        </p>

        <h2>3. Exception — incorrect product</h2>
        <p>
          If a product different from the one ordered was dispatched, or with different
          specifications (size, colour, etc.), the return postage costs are borne by
          the Seller.
        </p>

        <h2>4. Return conditions</h2>
        <p>
          The return must be made within <strong>14 days</strong> and under the
          following conditions:
        </p>
        <ul>
          <li>products must be returned sealed;</li>
          <li>
            the condition of the products must be identical — unused and showing no
            signs of wear;
          </li>
          <li>
            the product must be sent back in its original packaging, with all labels
            and associated accessories intact.
          </li>
        </ul>
        <p>
          If these conditions are not met, the Seller reserves the right to refuse the
          return or to charge a restocking fee.
        </p>

        <h2>5. How to initiate a return</h2>
        <p>
          Send us a message via the <Link href="/contact">contact page</Link>, including
          your order number and the reason for the return. We&apos;ll guide you through
          the return and refund process step by step.
        </p>
      </div>
    </>
  );
}
