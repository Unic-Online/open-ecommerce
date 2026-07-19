import { Link } from '@/i18n/navigation';
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
        <span className={styles.eyebrow}>Légal</span>
        <h1 className={styles.heroTitle}>Conditions générales</h1>
        <p className={styles.heroSub}>
          Conditions d&apos;utilisation du site et d&apos;achat des produits.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Éditeur du site</h2>
        <p>
          Le site Acme Store (<a href="https://shop.example.com">shop.example.com</a>)
          est édité et exploité par{' '}
          <strong>Acme Store Demo SRL</strong>, dont le siège social est situé
          1 rue Exemple, Bucarest, Roumanie (n° d&apos;enregistrement 00000000) — à
          remplacer par les informations de votre société.
        </p>

        <h2>2. Objet</h2>
        <p>
          Les présentes conditions générales régissent l&apos;utilisation du site et la
          vente transfrontalière de produits Acme Store aux clients établis en France.
          La conclusion d&apos;une commande implique l&apos;acceptation sans réserve des
          présentes conditions.
        </p>

        <h2>3. Commandes et paiement</h2>
        <p>
          Les prix sont indiqués en euros (EUR), toutes taxes comprises. Le paiement
          s&apos;effectue par carte bancaire, Revolut Pay, Apple Pay ou Google Pay via
          notre prestataire de paiement Revolut. La commande n&apos;est validée
          qu&apos;après confirmation du paiement.
        </p>

        <h2>4. Livraison</h2>
        <p>
          Les frais de livraison standard pour la France sont de 10 € par commande,
          offerts à partir de 300 € de produits. Les délais de livraison estimés sont
          communiqués lors de la confirmation de commande. La livraison ne couvre
          actuellement que la France métropolitaine.
        </p>

        <h2>5. Droit de rétractation</h2>
        <p>
          Conformément au Code de la consommation, vous disposez d&apos;un délai de
          14 jours calendaires à compter de la réception du produit pour exercer votre
          droit de rétractation, sans avoir à motiver votre décision. Les modalités de
          retour sont détaillées dans la{' '}
          <Link href="/politica-retur">politique de retour</Link>.
        </p>

        <h2>6. Garanties</h2>
        <p>
          Tous les produits bénéficient de la garantie légale de conformité (article
          L.217-3 et suivants du Code de la consommation) et de la garantie contre les
          vices cachés (articles 1641 et suivants du Code civil).
        </p>

        <h2>7. Données personnelles</h2>
        <p>
          Le traitement de vos données personnelles est décrit dans la{' '}
          <Link href="/politica-confidentialitate">politique de confidentialité</Link>,
          conforme au Règlement Général sur la Protection des Données (RGPD).
        </p>

        <h2>8. Droit applicable</h2>
        <p>
          Tout litige sera soumis à la médiation préalable, puis aux tribunaux compétents.
        </p>

        <h2>Contact</h2>
        <p>
          Pour toute question, contactez-nous à{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a> ou via la{' '}
          <Link href="/contact">page de contact</Link>.
        </p>
      </div>
    </>
  );
}
