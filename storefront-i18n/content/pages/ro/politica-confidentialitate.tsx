import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

interface PoliticaConfidentialitateContentProps {
  businessEmail: string;
  siteUrl: string;
}

export function PoliticaConfidentialitateContent({
  businessEmail,
  siteUrl,
}: PoliticaConfidentialitateContentProps) {
  const siteHost = siteUrl.replace(/^https?:\/\//, '');

  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.heroTitle}>Politica de confidențialitate</h1>
        <p className={styles.heroSub}>
          Protecția datelor cu caracter personal — angajamentul nostru.
        </p>
      </section>

      <div className={styles.container}>
        <h2>Protecție date cu caracter personal</h2>
        <p>
          Acme Store Demo SRL (denumită în continuare <strong>{siteHost}</strong>) cu sediul
          în Str. Exemplu 1, București, ROMÂNIA, nr. de Ordine în Registrul Comerțului
          J00/0000/2025, C.U.I. 00000000, atribuit fiscal RO (înlocuiește cu datele firmei
          tale), respectă confidențialitatea și securitatea prelucrării datelor cu caracter
          personal.
        </p>

        <h2>Definiții</h2>
        <p>
          <strong>ANSPDCP</strong> reprezintă Autoritatea Națională de Supraveghere a
          Prelucrării Datelor cu Caracter Personal.
        </p>
        <p>
          <strong>„Date cu caracter personal”</strong> înseamnă orice informații privind o
          persoană fizică identificată sau identificabilă (persoana vizată).
        </p>
        <p>
          <strong>„Prelucrare”</strong> înseamnă orice operațiune efectuată asupra datelor cu
          caracter personal — colectarea, înregistrarea, organizarea, structurarea,
          stocarea, adaptarea, modificarea, extragerea, consultarea, utilizarea, divulgarea,
          alinierea sau combinarea, restricționarea, ștergerea sau distrugerea.
        </p>
        <p>
          <strong>„Operator”</strong> înseamnă persoana fizică sau juridică care, singur sau
          împreună cu altele, stabilește scopurile și mijloacele de prelucrare a datelor cu
          caracter personal.
        </p>
        <p>
          <strong>„Consimțământ”</strong> al persoanei vizate înseamnă orice manifestare de
          voință liberă, specifică, informată și lipsită de ambiguitate prin care aceasta
          acceptă ca datele care o privesc să fie prelucrate.
        </p>

        <h2>Drepturile persoanei vizate</h2>
        <p>
          <strong>Dreptul de acces</strong> — dreptul de a obține o confirmare din partea
          operatorului dacă prelucrează sau nu datele care vă privesc și, în caz afirmativ,
          acces la datele respective.
        </p>
        <p>
          <strong>Dreptul la portabilitatea datelor</strong> — dreptul de a primi datele
          personale într-un format structurat, utilizat în mod curent și care poate fi citit
          automat, și de a le transmite altui operator.
        </p>
        <p>
          <strong>Dreptul la opoziție</strong> — dreptul de a vă opune prelucrării atunci
          când aceasta este necesară pentru îndeplinirea unei sarcini de interes public sau
          pentru un interes legitim al operatorului. Pentru marketing direct, vă puteți opune
          oricând.
        </p>
        <p>
          <strong>Dreptul la rectificare</strong> — corectarea, fără întârzieri nejustificate,
          a datelor inexacte stocate.
        </p>
        <p>
          <strong>Dreptul la ștergere („dreptul de a fi uitat”)</strong> — solicitarea
          ștergerii datelor în cazurile prevăzute de Regulament: nu mai sunt necesare,
          consimțământul e retras, datele au fost prelucrate ilegal etc.
        </p>
        <p>
          <strong>Dreptul la restricționarea prelucrării</strong> — limitarea prelucrării în
          situațiile specifice prevăzute de Regulament.
        </p>

        <h2>Ce tipuri de date colectăm</h2>
        <p>
          În general, colectăm datele direct de la dumneavoastră, astfel încât aveți
          controlul asupra informațiilor pe care ni le oferiți:
        </p>
        <ul>
          <li>Când vă creați cont pe {siteHost}: adresa de email, numele și prenumele.</li>
          <li>În contul personal puteți adăuga: număr telefon mobil, data nașterii, adrese de livrare.</li>
          <li>Când plasați o comandă: produsul dorit, numele, adresa de livrare, detalii de facturare, metoda de plată, numărul de telefon. Datele cardului bancar nu sunt stocate de noi — sunt procesate direct de Revolut.</li>
        </ul>

        <p>
          Putem colecta și prelucra anumite informații despre comportamentul dvs pe site,
          pentru a vă personaliza experiența. Pe site putem stoca și colecta informații în
          cookie-uri. <strong>Nu colectăm și nu prelucrăm date ale minorilor sub 16
          ani.</strong>
        </p>

        <p><strong>Informații colectate automat:</strong></p>
        <ul>
          <li>Informații despre browser și sistem de operare</li>
          <li>Informații despre dispozitivul mobil (brand, model, OS)</li>
          <li>Adresa IP</li>
          <li>Conținutul vizualizat și durata vizitei</li>
          <li>Sursa de unde ne-ați vizitat</li>
        </ul>

        <p><strong>Parteneri cu care colaborăm</strong> (toți asigură un nivel adecvat de protecție):</p>
        <ul>
          <li>Vercel / SiteGround (hosting)</li>
          <li>Google Analytics (analiză trafic)</li>
          <li>Meta (Facebook Pixel + CAPI)</li>
          <li>Revolut (procesare plăți)</li>
          <li>Resend (email-uri tranzacționale)</li>
          <li>SameDay (livrare)</li>
        </ul>

        <h2>De ce colectăm datele și care este temeiul</h2>
        <p>
          Conform Regulamentului 679/2016, prelucrăm datele dumneavoastră în baza
          următoarelor temeiuri:
        </p>

        <h3>Pentru prestarea serviciilor</h3>
        <ul>
          <li>Crearea și administrarea contului</li>
          <li>Prelucrarea comenzilor — preluare, validare, expediere, facturare</li>
          <li>Soluționarea anulărilor sau a problemelor referitoare la o comandă</li>
          <li>Returnarea sau înlocuirea produselor conform legii</li>
          <li>Rambursarea contravalorii produselor</li>
          <li>Asigurarea serviciilor de suport</li>
        </ul>

        <h3>Pentru marketing</h3>
        <p>
          Pentru a vă ține la curent cu produsele și ofertele care vă interesează, vă putem
          trimite emailuri cu informații generale, oferte sau campanii. Comunicările de
          marketing se bazează întotdeauna pe consimțământul dvs prealabil.
        </p>
        <p>Vă puteți răzgândi și retrage consimțământul oricând:</p>
        <ul>
          <li>Din footer-ul mailurilor primite, folosind butonul „unsubscribe”;</li>
          <li>
            Răspunzând la oricare mail primit de la noi cu cererea de dezabonare;
          </li>
          <li>
            Scriind direct la <a href={`mailto:${businessEmail}`}>{businessEmail}</a>.
          </li>
        </ul>

        <h3>Pentru apărarea intereselor noastre legitime</h3>
        <p>
          Pentru a ne proteja activitatea comercială luăm măsuri tehnice și organizatorice,
          inclusiv: măsuri de protecție a site-ului față de atacuri cibernetice și măsuri de
          gestionare a riscurilor.
        </p>

        <h2>Cât timp păstrăm datele dvs?</h2>
        <p>
          Ca regulă generală, vom stoca datele cât timp aveți cont activ. Chiar și după
          închiderea contului, în situațiile în care legislația și interesele legitime impun
          păstrarea anumitor informații (ex: facturi — 10 ani conform Codului Fiscal),
          vom păstra acele date.
        </p>

        <h2>Dezvăluirea datelor</h2>
        <p>După caz, putem transmite acces la anumite date următoarelor categorii de destinatari:</p>
        <ul>
          <li>Furnizori de servicii de curierat (SameDay)</li>
          <li>Furnizori de servicii de plată (Revolut)</li>
          <li>Furnizori de servicii IT (hosting, analytics)</li>
          <li>Furnizori de servicii de marketing (Resend, Meta, Google)</li>
        </ul>
        <p>
          <strong>Nu vom vinde niciodată datele dumneavoastră.</strong> În prezent, stocăm și
          prelucrăm datele pe teritoriul Uniunii Europene.
        </p>

        <h2>Securizarea datelor</h2>
        <p>
          Ne angajăm să asigurăm securitatea datelor prin măsuri tehnice și organizatorice
          adecvate, conform standardelor industriei: parolare a conturilor, protecție
          antivirus, antispam și firewall actualizate, acorduri de confidențialitate cu
          angajații și colaboratorii, criptare HTTPS pe întreg site-ul.
        </p>

        <h2>Politica poate fi schimbată</h2>
        <p>
          Avem dreptul de a modifica și completa Politica de Confidențialitate oricând,
          afișând politica actualizată pe această pagină.
        </p>

        <h2>Contact</h2>
        <p>
          Pentru orice întrebare legată de prelucrarea datelor dvs, ne puteți contacta la{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a> sau prin{' '}
          <Link href="/contact">pagina de contact</Link>.
        </p>

        <h2>Autoritatea Națională (ANSPDCP)</h2>
        <p>
          <strong>Adresă:</strong> B-dul G-ral Gheorghe Magheru 28-30, Sector 1, cod poștal
          010336, București, România
          <br />
          <strong>Email:</strong>{' '}
          <a href="mailto:anspdcp@dataprotection.ro">anspdcp@dataprotection.ro</a>
          <br />
          <strong>Telefon:</strong> +40 318.059.211; +40 318.059.212
        </p>

        <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#888' }}>
          Acme Store Demo SRL
        </p>
      </div>
    </>
  );
}
