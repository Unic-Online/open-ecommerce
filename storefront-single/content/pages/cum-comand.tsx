import { Link } from '@/lib/nav';
import styles from '@/components/InfoPage.module.css';

const steps = [
  {
    title: 'Choose your product',
    body: "Browse via the main menu to the category you need (Furniture, Lighting, Outdoor) or directly from the homepage. On each product page you'll find the photo gallery, full specifications, and availability — updated continuously.",
  },
  {
    title: 'Add to basket',
    body: 'Once you\'ve made your choice, click “Add to basket”. You can continue browsing other products — your basket is saved automatically. The number of selected items is always visible in the top-right corner.',
  },
  {
    title: 'Review your basket',
    body: 'Open the basket (icon in the top-right corner) and check the products, quantities, and total. Standard delivery is €10 and becomes free for orders where the product subtotal reaches at least €300.',
  },
  {
    title: 'Enter your details',
    body: 'Click “Proceed to checkout” and fill in your billing and delivery information: name, phone number, email, full address, and region. All data is encrypted and used solely for delivery purposes.',
  },
  {
    title: 'Choose your payment method',
    body: 'You can pay by card online via Revolut — Apple Pay, Google Pay, Visa, and Mastercard. Payment by card is processed securely; no one will ever ask for your PIN.',
  },
  {
    title: 'Confirm your order',
    body: "Click “Place order” for final confirmation. You'll immediately receive a confirmation email with your order number. We'll get in touch if there are any details to clarify and will let you know your estimated delivery date.",
  },
];

export function CumComandContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Step-by-step guide</span>
        <h1 className={styles.heroTitle}>How to order</h1>
        <p className={styles.heroSub}>
          From choosing your product to delivery — in 6 simple steps.
        </p>
      </section>

      <div className={styles.container}>
        <p>
          Placing an order on <strong>Acme Store</strong> takes just a few minutes.
          Below you&apos;ll find each step explained clearly — and if you have any
          questions, we&apos;re always available by email, on the{' '}
          <Link href="/contact">contact page</Link>.
        </p>

        <div className={styles.steps}>
          {steps.map((step, i) => (
            <div key={step.title} className={styles.step}>
              <div className={styles.stepNum}>{i + 1}</div>
              <div className={styles.stepBody}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2>Need help?</h2>
        <p>
          If you&apos;re having trouble placing an order or have questions about a
          product, write to us via the{' '}
          <Link href="/contact">contact page</Link> or by WhatsApp. We&apos;ll
          get back to you as soon as possible.
        </p>
      </div>
    </>
  );
}
