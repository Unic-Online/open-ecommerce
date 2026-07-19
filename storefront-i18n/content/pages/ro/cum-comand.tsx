import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

const steps = [
  {
    title: 'Alege produsul',
    body: 'Navighează din meniul principal pe categoria dorită (Mobilier, Iluminat, Exterior) sau direct de pe pagina de start. Pe pagina fiecărui produs vei găsi galerie foto, specificații complete și disponibilitate în stoc — actualizate constant.',
  },
  {
    title: 'Adaugă în coș',
    body: 'După ce te decizi, apasă pe butonul „Adaugă în coș”. Poți continua să răsfoiești și alte produse — coșul rămâne salvat. În dreapta-sus vei vedea oricând câte produse ai selectat.',
  },
  {
    title: 'Verifică coșul',
    body: 'Deschide coșul (iconița din dreapta-sus) și verifică produsele, cantitatea și totalul. Livrarea costă 29 RON și devine gratuită pentru comenzi cu subtotal produse de cel puțin 600 RON.',
  },
  {
    title: 'Completează datele',
    body: 'Apasă „Finalizează comanda” și completează datele de facturare și livrare: nume, telefon, email, adresă completă și județ. Toate datele sunt criptate și folosite doar pentru livrarea comenzii.',
  },
  {
    title: 'Alege metoda de plată',
    body: 'Poți plăti ramburs (cash la curier) sau cu cardul online prin Revolut — Apple Pay, Google Pay, Visa și Mastercard. Plata cu cardul este procesată criptat; nimeni nu îți va cere niciodată codul PIN.',
  },
  {
    title: 'Confirmă comanda',
    body: 'Apasă „Plasează comanda” pentru confirmarea finală. Vei primi imediat un email de confirmare cu numărul comenzii. Te contactăm dacă mai sunt detalii de clarificat și îți comunicăm termenul de livrare.',
  },
];

export function CumComandContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Ghid pas cu pas</span>
        <h1 className={styles.heroTitle}>Cum comand?</h1>
        <p className={styles.heroSub}>
          De la alegerea produsului până la livrare — în 6 pași simpli.
        </p>
      </section>

      <div className={styles.container}>
        <p>
          Comanda pe <strong>ro.shop.example.com</strong> durează câteva minute. Mai jos găsești
          fiecare pas explicat clar — iar dacă ai întrebări, suntem oricând la un email
          distanță, pe <Link href="/contact">pagina de contact</Link>.
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

        <h2>Ai nevoie de ajutor?</h2>
        <p>
          Dacă întâmpini probleme cu plasarea comenzii sau ai întrebări despre un produs,
          scrie-ne pe <Link href="/contact">pagina de contact</Link> sau pe WhatsApp.
          Răspundem în cel mai scurt timp posibil.
        </p>
      </div>
    </>
  );
}
