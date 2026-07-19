import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

export function PoliticaReturContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Légal</span>
        <h1 className={styles.heroTitle}>Politique de retour</h1>
        <p className={styles.heroSub}>
          14 jours pour changer d&apos;avis — sans pénalité et sans justification.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Délai de rétractation</h2>
        <p>
          L&apos;Acheteur a le droit de renoncer aux produits achetés sur le site, sans
          pénalité et sans justification, dans un délai de{' '}
          <strong>14 jours calendaires</strong> à compter de la réception des produits.
        </p>

        <h2>2. Frais de retour</h2>
        <p>
          Dans tous les cas de retour, les frais de transport pour le retour sont à la
          charge de l&apos;Acheteur.
        </p>

        <h2>3. Exception — produit erroné</h2>
        <p>
          Si un produit différent de celui commandé a été expédié, ou avec des
          spécifications différentes (taille, couleur, etc.), les frais de transport sont
          à la charge du Vendeur.
        </p>

        <h2>4. Conditions de retour</h2>
        <p>
          Le retour doit être effectué dans un délai de <strong>14 jours</strong> et dans
          les conditions suivantes :
        </p>
        <ul>
          <li>les produits doivent être retournés scellés ;</li>
          <li>
            l&apos;état des produits doit être identique — non utilisés et sans traces
            d&apos;usure ;
          </li>
          <li>
            le produit doit être renvoyé dans son emballage d&apos;origine, avec toutes
            les étiquettes et accessoires associés intacts.
          </li>
        </ul>
        <p>
          Dans le cas contraire, le Vendeur se réserve le droit de refuser le retour ou de
          facturer des frais de remise en état.
        </p>

        <h2>5. Comment initier le retour ?</h2>
        <p>
          Envoyez-nous un message via la <Link href="/contact">page de contact</Link> en
          précisant le numéro de commande et le motif du retour. Nous vous guidons pas à
          pas pour le retour et le remboursement.
        </p>
      </div>
    </>
  );
}
