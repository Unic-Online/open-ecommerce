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
        <span className={styles.eyebrow}>Légal</span>
        <h1 className={styles.heroTitle}>Politique de confidentialité</h1>
        <p className={styles.heroSub}>
          Protection des données à caractère personnel — notre engagement.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement de vos données personnelles est{' '}
          <strong>Acme Store Demo SRL</strong>, dont le siège social est situé
          1 rue Exemple, Bucarest, Roumanie, éditrice de la marque Acme Store — à remplacer
          par les informations de votre société.
        </p>

        <h2>2. Données collectées</h2>
        <p>
          Nous collectons uniquement les données nécessaires au traitement de votre
          commande et à la relation client : identité, adresse de livraison et de
          facturation, email, téléphone, historique des commandes, adresse IP et
          informations techniques relatives à votre navigation (cookies). Le paiement
          est traité par Revolut ; nous ne stockons aucune donnée carte bancaire.
        </p>

        <h2>3. Base légale et finalités</h2>
        <ul>
          <li>
            <strong>Exécution du contrat —</strong> traitement de la commande, livraison,
            service après-vente.
          </li>
          <li>
            <strong>Obligation légale —</strong> conservation comptable et fiscale.
          </li>
          <li>
            <strong>Intérêt légitime —</strong> sécurité du site, prévention de la fraude.
          </li>
          <li>
            <strong>Consentement —</strong> communications marketing, cookies analytiques
            et publicitaires (Meta Pixel, Google Analytics). Vous pouvez retirer votre
            consentement à tout moment via la bannière de cookies.
          </li>
        </ul>

        <h2>4. Destinataires</h2>
        <p>
          Vos données sont partagées uniquement avec nos sous-traitants techniques :
          Revolut (paiement), Resend (envoi d&apos;emails transactionnels), MongoDB Atlas
          (hébergement de la base), Vercel (hébergement applicatif), Meta et Google
          (analytics et publicité, sous réserve de consentement). Nous ne vendons jamais
          vos données.
        </p>

        <h2>5. Durée de conservation</h2>
        <p>
          Les données de commande sont conservées pendant la durée légale (10 ans pour
          les pièces comptables). Les paniers abandonnés et les contacts marketing sont
          anonymisés au-delà de 180 jours sans activité.
        </p>

        <h2>6. Vos droits</h2>
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez
          d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation,
          de portabilité et d&apos;opposition. Vous pouvez exercer ces droits en nous
          écrivant à <a href={`mailto:${businessEmail}`}>{businessEmail}</a>. Vous
          avez également le droit d&apos;introduire une réclamation auprès de la CNIL
          (<a href="https://www.cnil.fr">www.cnil.fr</a>).
        </p>

        <h2>7. Transferts hors UE</h2>
        <p>
          Les données ne sont pas transférées hors de l&apos;Espace Économique Européen
          au-delà de ce qui est strictement nécessaire au fonctionnement de nos
          sous-traitants techniques, qui présentent les garanties contractuelles requises
          par le RGPD.
        </p>

        <h2>Contact protection des données</h2>
        <p>
          Pour toute question liée au traitement de vos données, contactez-nous à{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a> ou via la{' '}
          <Link href="/contact">page de contact</Link>.
        </p>
      </div>
    </>
  );
}
