import { Link } from '@/i18n/navigation';
import styles from '@/components/InfoPage.module.css';

interface TermeniConditiiContentProps {
  businessEmail: string;
  siteUrl: string;
}

export function TermeniConditiiContent({
  businessEmail,
  siteUrl,
}: TermeniConditiiContentProps) {
  const siteHost = siteUrl.replace(/^https?:\/\//, '');

  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.heroTitle}>Termeni și condiții</h1>
        <p className={styles.heroSub}>
          Condițiile de utilizare a site-ului și de cumpărare a produselor.
        </p>
      </section>

      <div className={styles.container}>
        <h2>1. Elemente definitorii</h2>
        <p>
          <strong>1.1.</strong> Magazinul online Acme Store este administrat și deținut prin
          intermediul site-ului <a href={siteUrl}>{siteHost}</a> (denumit în continuare
          „Site”) de către <strong>Acme Store Demo SRL</strong>, cu sediul social în
          Str. Exemplu 1, București, ROMÂNIA, cod unic de înregistrare 00000000, nr. de
          înregistrare la Registrul Comerțului J00/0000/2025 — înlocuiește cu datele firmei
          tale.
        </p>
        <p><strong>1.2.</strong> În cuprinsul acestui document, următorii termeni vor însemna:</p>
        <ul>
          <li><strong>„Vânzător”</strong>: Acme Store Demo SRL.</li>
          <li><strong>„Cumpărător”</strong>: persoana, firma sau altă entitate juridică ce accesează Site-ul și plasează o Comandă.</li>
          <li><strong>„Bunuri și Servicii”</strong>: orice produs sau serviciu prezentat pe Site, inclusiv cele menționate în Comandă.</li>
          <li><strong>„Specificații”</strong>: toate specificațiile și/sau descrierea Bunurilor și Serviciilor.</li>
          <li><strong>„Comanda”</strong>: documentul electronic prin care Vânzătorul este de acord să livreze Cumpărătorului Bunuri și Servicii, iar Cumpărătorul este de acord să le primească și să efectueze plata.</li>
          <li><strong>„Contract”</strong>: Comanda confirmată de Vânzător prin emiterea facturii fiscale. Încheierea Contractului nu are loc la plasarea Comenzii sau emiterea confirmării de primire.</li>
        </ul>
        <p>
          <strong>1.3.</strong> Prin accesarea și utilizarea Site-ului sau cumpărarea
          Bunurilor și Serviciilor prezentate pe Site vă exprimați acceptul față de
          dispozițiile prezentului document, precum și a Politicii de Confidențialitate care
          face parte integrantă din acesta.
        </p>

        <h2>2. Modificarea termenilor de utilizare</h2>
        <p>
          <strong>2.1.</strong> Vânzătorul își rezervă dreptul de a modifica oricând Termenii
          și Condițiile, fără o notificare prealabilă. Modificările devin obligatorii cu
          efect imediat. Continuarea utilizării Site-ului după modificare constituie
          acceptarea acestora.
        </p>

        <h2>3. Documente contractuale</h2>
        <p>
          <strong>3.1.</strong> În momentul plasării unei Comenzi, Cumpărătorul își exprimă
          acordul pentru a primi din partea Vânzătorului mesaje comerciale electronice și/sau
          telefonice. Plasarea Comenzii va fi urmată de contactarea prin email și/sau
          telefon.
        </p>
        <p>
          <strong>3.2.</strong> Expedierea prin email a notificării de livrare către
          Cumpărător constituie momentul încheierii Contractului la distanță. Comanda poate
          fi anulată înainte de expedierea acestei notificări scriind la{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a>.
        </p>

        <h2>4. Drepturi de proprietate intelectuală</h2>
        <p>
          <strong>4.1.</strong> Întregul conținut al site-ului{' '}
          <a href={siteUrl}>{siteHost}</a> este proprietatea Acme Store Demo SRL și este
          protejat de legea dreptului de autor. Folosirea în alt scop decât cel personal sau
          non-comercial este strict interzisă fără acordul expres scris în prealabil al
          proprietarului.
        </p>

        <h2>5. Conduita interzisă</h2>
        <p><strong>5.1.</strong> Este strict interzis:</p>
        <ul>
          <li>copierea sau dezasamblarea codului sursă a Site-ului ori a oricărui element conținut în servicii;</li>
          <li>utilizarea serviciilor Site-ului în alte scopuri decât cele personale și non-comerciale;</li>
          <li>vânzarea, închirierea, distribuția sau acordarea de drepturi unei terțe persoane privind serviciile Site-ului ori contul creat;</li>
          <li>folosirea serviciilor pentru a invada intimitatea terților, pentru data mining sau colectare automată;</li>
          <li>impersonarea unei alte persoane sau falsa afiliere.</li>
        </ul>
        <p>
          <strong>5.2.</strong> Ca urmare a încălcării oricărei interdicții, Vânzătorul are
          dreptul să blocheze cu efect imediat, temporar sau permanent, accesul la contul
          implicat.
        </p>

        <h2>6. Înregistrarea pe site</h2>
        <p>
          <strong>6.1.</strong> Accesul la bunurile și serviciile Vânzătorului se poate face
          online, prin crearea unui cont pe Site. Pentru a crea un cont este nevoie de o
          adresă de e-mail personală, prin care se va desfășura comunicarea cu reprezentanții
          Vânzătorului.
        </p>
        <p>
          <strong>6.2.</strong> Prin crearea contului declarați că datele furnizate sunt
          corecte și complete și acceptați că sunteți răspunzător pentru activitatea
          desfășurată prin contul dumneavoastră.
        </p>

        <h2>7. Cum comand?</h2>
        <p>
          Detaliile pas cu pas le găsești pe <Link href="/cum-comand">pagina dedicată „Cum
          comand?”</Link>.
        </p>

        <h2>8. Prețul</h2>
        <p>
          <strong>8.1.</strong> Toate prețurile afișate sunt în LEI și includ TVA.
          Prețurile afișate nu includ cheltuielile de livrare.
        </p>
        <p>
          <strong>8.2.</strong> Din cauze tehnice, anumite produse pot avea prețurile
          afișate eronat. Dacă diferența dintre prețul corect și cel afișat este de peste
          20%, ne rezervăm dreptul de a vă contacta sau de a anula comanda.
        </p>
        <p>
          <strong>8.3.</strong> Vânzătorul își rezervă dreptul de a modifica prețurile în
          orice moment. Noile prețuri vor fi aplicabile numai serviciilor achiziționate după
          data modificării.
        </p>

        <h2>9. Modalități de plată</h2>
        <p>
          Plata poate fi făcută în sistem ramburs (cash la livrare) sau cu cardul bancar.
        </p>
        <p>
          <strong>Ramburs</strong> permite achitarea comenzii în numerar, în momentul
          livrării, către reprezentantul curierului.
        </p>
        <p>
          <strong>Plata cu cardul</strong> înseamnă că o comandă este achitată integral
          online, prin cardul bancar, în momentul plasării. După trimiterea comenzii veți fi
          redirecționat către pagina de plată Revolut, unde introduceți detaliile de plată.
          Plata este realizată în condiții de siguranță.
        </p>
        <p>
          <strong>Atenție!</strong> Nimeni nu vă va cere vreodată codul PIN, numărul cardului
          sau CVV-ul — nici reprezentanții Acme Store Demo SRL, nici cei ai procesatorului de
          plăți, nici reprezentanții băncii.
        </p>

        <h2>10. Facturarea</h2>
        <p>
          Fiecare Comandă confirmată include specificațiile Bunurilor și Serviciilor,
          prețurile, modalitatea și termenul de plată. Factura fiscală se emite pentru
          bunurile și serviciile livrate, prețurile fiind identice cu cele specificate în
          mesajul de confirmare a Comenzii. Factura este trimisă electronic, pe adresa de
          email pe care a fost plasată comanda.
        </p>

        <h2>11. Transferul proprietății</h2>
        <p>
          Proprietatea asupra bunurilor va fi transferată în momentul livrării la adresa
          indicată (presupunând semnarea de primire a documentului de transport furnizat de
          curier) și a efectuării plății integrale.
        </p>

        <h2>12. Livrarea</h2>
        <p>
          <strong>12.1.</strong> Vânzătorul se obligă să expedieze produsele cuprinse în
          Comanda finalizată, respectând termenele comunicate la confirmare. Tariful de
          livrare aferent metodei alese este afișat înainte de plasarea Comenzii.
        </p>
        <p>
          <strong>12.2.</strong> Produsele sunt ambalate corespunzător, iar factura fiscală
          este trimisă electronic, atașată la email.
        </p>
        <p>
          <strong>12.3.</strong> Din cauza condițiilor impuse de firma de curierat,
          Cumpărătorului nu îi este permisă deschiderea coletului decât ulterior semnării de
          primire și achitării contravalorii acestuia.
        </p>
        <p>
          <strong>12.4.</strong> În cazul în care coletele prezintă deteriorări vizibile la
          primire, recomandăm refuzul primirii și semnalizarea imediată prin email la{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a>.
        </p>
        <p>
          <strong>12.5.</strong> Dacă termenele de livrare nu pot fi respectate, Vânzătorul
          va anunța Cumpărătorul și va comunica termenul estimat. Dacă noul termen nu este
          acceptat, comanda se anulează.
        </p>
        <p>
          <strong>12.6.</strong> Dacă informațiile de livrare furnizate sunt incomplete sau
          incorecte, termenele de livrare nu sunt garantate. Dacă în 24 de ore informațiile
          nu sunt corectate, Vânzătorul își rezervă dreptul de a anula comanda.
        </p>
        <p>
          <strong>12.7. Livrarea prin curier.</strong> Costul de livrare pe teritoriul
          României este 29 RON. Livrarea este gratuită pentru comenzile cu subtotal produse
          de cel puțin 600 RON. Costul final este calculat automat înainte de plasarea
          comenzii. Curierul contactează Cumpărătorul în prealabil. Dacă livrarea nu se
          realizează în două încercări, coletul revine la Vânzător și comanda se anulează.
        </p>

        <h2>13. Dreptul de returnare</h2>
        <p>
          Detaliile complete sunt în <Link href="/politica-retur">Politica de retur</Link>.
          Pe scurt: 14 zile calendaristice de la primire, fără invocarea unui motiv,
          conform OG 130/2000.
        </p>

        <h2>14. Ștergerea contului</h2>
        <p>Ștergerea contului se poate realiza:</p>
        <ul>
          <li>la solicitarea dumneavoastră, prin email la <a href={`mailto:${businessEmail}`}>{businessEmail}</a>;</li>
          <li>de către Vânzător, ca urmare a încălcării prezentului contract;</li>
          <li>de către Vânzător, în caz de neutilizare pe o perioadă mai mare de 36 de luni.</li>
        </ul>

        <h2>15. Limitarea răspunderii</h2>
        <p>
          Acme Store Demo SRL nu garantează disponibilitatea neîntreruptă și lipsită de
          deficiențe a bunurilor și serviciilor prezentate pe Site. Niciuna dintre părți nu
          va fi răspunzătoare pentru neexecutarea obligațiilor contractuale cauzate de
          evenimente de forță majoră (cauze naturale sau cauze umane recunoscute de lege).
        </p>

        <h2>16. Relații cu clienții</h2>
        <p>
          Pentru informații sau reclamații, vă rugăm să ne contactați la{' '}
          <a href={`mailto:${businessEmail}`}>{businessEmail}</a> sau prin{' '}
          <Link href="/contact">pagina de contact</Link>.
        </p>

        <h2>17. Jurisdicția / litigii</h2>
        <p>
          Prezentul document este guvernat de legislația română aflată în vigoare. Orice
          neînțelegeri se vor rezolva pe cale amiabilă; în caz contrar, se va apela la
          instanțele judecătorești românești competente.
        </p>
      </div>
    </>
  );
}
