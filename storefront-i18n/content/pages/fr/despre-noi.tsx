import styles from '@/components/InfoPage.module.css';
import TrademarkNotice from '@/components/TrademarkNotice';

const values = [
  {
    icon: '🛟',
    title: 'Un support attentif',
    desc: "Parfois les choses ne sont pas aussi simples qu'elles paraissent. Nous restons à votre écoute pour répondre à vos questions — par email, téléphone ou WhatsApp.",
  },
  {
    icon: '❤️',
    title: 'Passion',
    desc: "Nous savons à quel point le choix d'un produit qui entre chez vous est important. Nous ne sélectionnons que des pièces qui méritent leur place.",
  },
  {
    icon: '🎯',
    title: 'Professionnalisme',
    desc: "Notre équipe est composée de personnes attentives aux détails, qui choisissent les produits selon des critères clairs : qualité, sécurité, durabilité.",
  },
  {
    icon: '🏡',
    title: 'Pour votre maison',
    desc: "Nous composons une collection cohérente — des coffres-forts certifiés aux douches et éviers — pour que vous trouviez en un seul endroit les pièces qui comptent.",
  },
];

export function DespreNoiContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Acme Store</span>
        <h1 className={styles.heroTitle}>À propos</h1>
        <p className={styles.heroSub}>
          La collection pour votre maison — des produits choisis avec soin par des
          personnes qui s&apos;impliquent.
        </p>
      </section>

      <div className={styles.container}>
        <h2>Pourquoi nous ?</h2>
        <p>
          L&apos;équipe <strong>Acme Store</strong> est composée de passionnés de design et
          de qualité — des personnes qui comprennent à quel point les objets qui rythment
          vos journées comptent. Nous sommes là pour proposer des solutions haut de gamme
          pour la maison, faciles à commander et à installer, qui placent vos besoins en
          premier.
        </p>

        <h2>Notre mission</h2>
        <p>
          Notre mission est de rendre votre vie plus sûre et plus belle — en proposant des
          produits de qualité, recommandés en toute transparence, avec un vrai support
          avant et après la commande. Acme Store est là pour répondre à vos questions, pas
          seulement pour conclure une vente.
        </p>

        <h2>Notre vision</h2>
        <p>
          Nous construisons une collection complète pour votre maison — de la sécurité
          (coffres-forts certifiés S2) à la salle de bain (douches intelligentes avec
          écran LED) jusqu&apos;à la cuisine (éviers multifonctions) — tous sélectionnés
          selon les mêmes standards et accompagnés du même niveau de support.
        </p>

        <h2>Nos valeurs</h2>
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
