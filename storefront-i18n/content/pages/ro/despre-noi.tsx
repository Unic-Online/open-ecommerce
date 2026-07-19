import styles from '@/components/InfoPage.module.css';
import TrademarkNotice from '@/components/TrademarkNotice';

const values = [
  {
    icon: '🛟',
    title: 'Suport prietenos',
    desc: 'Uneori lucrurile nu sunt atât de simple precum par, dar suntem mereu aici pentru a răspunde întrebărilor tale — pe email, telefon sau WhatsApp.',
  },
  {
    icon: '❤️',
    title: 'Pasiune',
    desc: 'Știm cât de importantă este alegerea unui produs care intră în casa ta. Selectăm doar piese care merită locul respectiv.',
  },
  {
    icon: '🎯',
    title: 'Profesionalism',
    desc: 'Echipa noastră este formată din oameni atenți la detalii, care aleg produsele după criterii clare: calitate, siguranță, durabilitate.',
  },
  {
    icon: '🏡',
    title: 'Pentru casa ta',
    desc: 'Curatăm o colecție coerentă — de la mobilier din lemn masiv, la iluminat decorativ și soluții pentru exterior — astfel încât să găsești într-un singur loc piesele care contează.',
  },
];

export function DespreNoiContent() {
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Acme Store</span>
        <h1 className={styles.heroTitle}>Despre noi</h1>
        <p className={styles.heroSub}>
          Colecția pentru casa ta — produse alese cu grijă, oameni cărora le pasă.
        </p>
      </section>

      <div className={styles.container}>
        <h2>De ce noi?</h2>
        <p>
          Echipa <strong>Acme Store</strong> este formată din pasionați de design și calitate —
          oameni care înțeleg cât de importante sunt obiectele care îți populează zilele.
          Suntem aici ca să oferim soluții premium pentru locuință, ușor de comandat și de
          montat, care pun pe primul loc nevoile tale.
        </p>

        <h2>Misiunea noastră</h2>
        <p>
          Misiunea noastră este să-ți facem viața mai simplă, dar și mai frumoasă — oferind
          produse de calitate, recomandate transparent, cu suport real înainte și după
          comandă. Acme Store e aici pentru a răspunde întrebărilor tale, nu doar pentru a
          bifa o vânzare.
        </p>

        <h2>Viziunea noastră</h2>
        <p>
          Ne dorim să construim o colecție completă pentru casa ta — de la mobilier din
          lemn masiv, la iluminat decorativ pentru orice cameră, până la soluții pentru
          exterior și grădină — toate selectate după aceleași standarde și toate
          însoțite de același nivel de suport.
        </p>

        <h2>Valorile noastre</h2>
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
