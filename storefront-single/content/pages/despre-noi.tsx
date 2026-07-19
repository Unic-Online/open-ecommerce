import styles from '@/components/InfoPage.module.css';
import TrademarkNotice from '@/components/TrademarkNotice';

const values = [
  {
    icon: '🛟',
    title: 'Attentive support',
    desc: "Sometimes things aren't as straightforward as they seem. We're here to answer your questions — by email, phone, or WhatsApp.",
  },
  {
    icon: '❤️',
    title: 'Passion',
    desc: "We know how important it is to choose a product that will live in your home. We only select pieces that truly deserve their place.",
  },
  {
    icon: '🎯',
    title: 'Professionalism',
    desc: "Our team is made up of detail-oriented people who choose products according to clear criteria: quality, safety, and durability.",
  },
  {
    icon: '🏡',
    title: 'For your home',
    desc: "We curate a cohesive collection — from solid-wood furniture to decorative lighting and outdoor pieces — so you can find everything that matters in one place.",
  },
];

export function DespreNoiContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Acme Store</span>
        <h1 className={styles.heroTitle}>About us</h1>
        <p className={styles.heroSub}>
          The collection for your home — products chosen with care by people who
          are genuinely invested.
        </p>
      </section>

      <div className={styles.container}>
        <h2>Why us?</h2>
        <p>
          The <strong>Acme Store</strong> team is made up of people passionate about
          design and quality — people who understand how much the objects that shape
          your daily life matter. We&apos;re here to offer premium home solutions that
          are easy to order and install, putting your needs first.
        </p>

        <h2>Our mission</h2>
        <p>
          Our mission is to make your life simpler and more beautiful — by offering
          quality products, recommended with full transparency, and backed by genuine
          support before and after your order. Acme Store is here to answer your
          questions, not just to close a sale.
        </p>

        <h2>Our vision</h2>
        <p>
          We&apos;re building a complete collection for your home — from solid-wood
          furniture, to decorative lighting for every room, through to outdoor and
          garden pieces — all selected to the same standards and accompanied by the
          same level of support.
        </p>

        <h2>Our values</h2>
        <div className={styles.valueGrid}>
          {values.map((v) => (
            <div key={v.title} className={styles.valueCard}>
              <span className={styles.valueIcon} aria-hidden="true">{v.icon}</span>
              <h3 className={styles.valueTitle}>{v.title}</h3>
              <p className={styles.valueDesc}>{v.desc}</p>
            </div>
          ))}
        </div>

        <TrademarkNotice variant="full" />
      </div>
    </>
  );
}
