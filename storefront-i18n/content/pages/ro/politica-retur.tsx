import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

export function PoliticaReturContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.heroTitle}>Politica de retur</h1>
        <p className={styles.heroSub}>
          14 zile pentru a te răzgândi — fără penalități și fără explicații.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Termenul de returnare</h2>
        <p>
          Cumpărătorul are dreptul să renunțe la produsele achiziționate de pe site, fără
          penalități și fără invocarea unui motiv, în termen de <strong>14 zile
          calendaristice</strong> de la primirea produselor, conform prevederilor OG
          130/2000 privind protecția consumatorilor la încheierea și executarea contractelor
          la distanță.
        </p>

        <h2>2. Costurile de transport</h2>
        <p>
          În toate cazurile returnării produselor, costurile de transport pentru returnare
          vor fi suportate de către Cumpărător.
        </p>

        <h2>3. Excepție — produs greșit</h2>
        <p>
          În cazul în care a fost trimis un produs diferit față de cel comandat sau cu alte
          specificații (mărime diferită, culoare diferită etc.), taxele de transport vor fi
          suportate de Vânzător.
        </p>

        <h2>4. Condiții de returnare</h2>
        <p>
          Renunțarea la cumpărarea unui produs se va face în cel mult <strong>14 zile</strong>{' '}
          de la retur și în următoarele condiții:
        </p>
        <ul>
          <li>produsele trebuie returnate sigilate;</li>
          <li>
            starea produselor trebuie să fie la fel — să nu fi fost folosite sau să prezinte
            urme de uzură;
          </li>
          <li>
            produsul trebuie trimis în ambalajul original, împreună cu toate etichetele și
            accesoriile aferente, intacte (ex: etichetele să nu fie rupte sau tăiate).
          </li>
        </ul>
        <p>
          În caz contrar, Vânzătorul își rezervă dreptul de a refuza returul sau de a percepe
          o taxă pentru aducerea produselor la stare de vandabilitate.
        </p>

        <h2>5. Cum inițiez returul?</h2>
        <p>
          Trimite-ne un mesaj prin <Link href="/contact">pagina de contact</Link> menționând
          numărul comenzii și motivul returului. Te ghidăm pas cu pas pentru returnare și
          rambursare.
        </p>
      </div>
    </>
  );
}
