import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

const steps = [
  {
    title: 'Choisissez le produit',
    body: "Naviguez depuis le menu principal vers la catégorie souhaitée (Coffres-forts, Douches, Éviers) ou directement depuis la page d'accueil. Sur la page de chaque produit, vous trouverez la galerie photo, les spécifications complètes et la disponibilité — mises à jour en continu.",
  },
  {
    title: 'Ajoutez au panier',
    body: "Une fois votre choix fait, cliquez sur « Ajouter au panier ». Vous pouvez continuer à parcourir d'autres produits — votre panier reste enregistré. En haut à droite, vous voyez à tout moment le nombre d'articles sélectionnés.",
  },
  {
    title: 'Vérifiez le panier',
    body: "Ouvrez le panier (icône en haut à droite) et vérifiez les produits, la quantité et le total. La livraison coûte 29 RON et devient gratuite pour les commandes dont le sous-total produits atteint au moins 600 RON.",
  },
  {
    title: 'Renseignez vos informations',
    body: "Cliquez sur « Finaliser la commande » et renseignez les informations de facturation et de livraison : nom, téléphone, email, adresse complète et région. Toutes les données sont chiffrées et utilisées uniquement pour la livraison.",
  },
  {
    title: 'Choisissez le mode de paiement',
    body: "Vous pouvez payer à la livraison (espèces au livreur) ou par carte en ligne via Revolut — Apple Pay, Google Pay, Visa et Mastercard. Le paiement par carte est traité de façon chiffrée ; personne ne vous demandera jamais votre code PIN.",
  },
  {
    title: 'Confirmez la commande',
    body: "Cliquez sur « Passer la commande » pour la confirmation finale. Vous recevrez immédiatement un email de confirmation avec le numéro de commande. Nous vous contactons s'il y a des détails à clarifier et nous vous communiquons le délai de livraison.",
  },
];

export function CumComandContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Guide pas à pas</span>
        <h1 className={styles.heroTitle}>Comment commander ?</h1>
        <p className={styles.heroSub}>
          Du choix du produit à la livraison — en 6 étapes simples.
        </p>
      </section>

      <div className={styles.container}>
        <p>
          Passer commande sur <strong>Acme Store</strong> ne prend que quelques minutes.
          Vous trouverez ci-dessous chaque étape expliquée clairement — et si vous avez des
          questions, nous restons à votre disposition par email, sur la{' '}
          <Link href="/contact">page de contact</Link>.
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

        <h2>Besoin d&apos;aide ?</h2>
        <p>
          Si vous rencontrez des difficultés pour passer commande ou si vous avez des
          questions sur un produit, écrivez-nous via la{' '}
          <Link href="/contact">page de contact</Link> ou par WhatsApp. Nous vous
          répondons dans les plus brefs délais.
        </p>
      </div>
    </>
  );
}
