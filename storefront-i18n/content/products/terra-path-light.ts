import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'terra-path-light',
  category: 'outdoor',
  business: {
    inStock: true,
    reviewsKey: 'terra-path-light',
    popularSlugs: ['oslo-nightstand', 'halo-table-lamp'],
    prices: {
      english: { price: 69, oldPrice: 89, currency: 'EUR' },
      ro: { price: 349, oldPrice: 449, currency: 'RON' },
    },
  },
  locales: {
    en: {
      shortName: 'Terra Solar Path Light',
      fullTitle: 'Terra Solar Path Light (Set of 2) — Anthracite Aluminium Garden Bollards',
      tagline: 'Wire-free solar path lighting, set of 2',
      shortDescription:
        'A set of 2 solar-powered path lights in anthracite powder-coated aluminium. Push the ground spike in, and they turn on automatically every dusk — no wiring, no electrician, no running costs.',
      badge: 'Solar powered',
      availabilityNote: 'In stock — ships in 2–4 business days',
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Outdoor', href: '/outdoor' },
      ],
      categoryLink: { label: 'Outdoor', href: '/outdoor' },
      gallery: [
        { src: '/images/terra-path-light/1.jpg', label: 'Terra Solar Path Light — front view of the pair', aspect: '1/1' },
        { src: '/images/terra-path-light/2.jpg', label: 'Terra Solar Path Light — solar panel top and ground spike detail', aspect: '1/1' },
        { src: '/images/terra-path-light/3.jpg', label: 'Terra Solar Path Light — lining a garden path at dusk', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'The **Terra Solar Path Light** brings a warm, golden glow to any garden path — automatically, every evening, without a single cable. This **set of 2** anthracite bollards charges silently through the day and switches itself on at dusk, off at dawn. No electrician, no trenching, no ongoing electricity cost.',
        },
        { kind: 'heading', text: 'Zero wiring — just push and go' },
        {
          kind: 'paragraph',
          body: 'Each light arrives fully assembled. Push the **stainless steel ground spike** into soil or gravel, angle the solar panel toward the sky, and you are done. Repositioning for the seasons takes under a minute — lift, move, push. The **set of 2** gives you instant symmetry flanking a path entrance or spaced evenly along a longer run.',
        },
        { kind: 'heading', text: 'Built to last' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'IP65 weatherproof anthracite aluminium',
              description:
                'The body is die-cast aluminium with a durable anthracite powder-coat finish — resistant to UV fading, rain, frost, and coastal salt air. IP65 rated, so neither dust nor a hosepipe will trouble it.',
            },
            {
              title: 'Automatic dusk-to-dawn light sensor',
              description:
                'A precision ambient-light sensor switches the warm-white 3000 K LED on at dusk and off at sunrise, every day. No timer to set, no app to configure — it simply works.',
            },
            {
              title: 'Replaceable rechargeable battery — ~8 h runtime',
              description:
                'The integrated rechargeable battery delivers up to **8 hours of light** on a full sunny-day charge. The battery compartment is user-accessible, so you can replace it years down the line without buying a new fixture.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/terra-path-light/2.jpg',
            label: 'Close-up of the solar panel top and stainless steel ground spike',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specifications' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Powder-coated aluminium, IP65' },
            { label: 'Set contents', value: 'Set of 2 path lights + ground spikes' },
            { label: 'Dimensions', value: 'Height ~40 cm, head Ø 8 cm' },
            { label: 'Weight', value: '0.6 kg per unit' },
            { label: 'Light', value: 'Warm white 3000 K LED' },
            { label: 'Power', value: 'Integrated solar panel + rechargeable battery' },
            { label: 'Runtime', value: 'Up to 8 hours on full charge' },
            { label: 'Sensor', value: 'Automatic dusk-to-dawn' },
            { label: 'Warranty', value: '2 years' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'For a longer path or a full garden border, simply order multiple sets — the anthracite finish and warm-white colour temperature are identical across sets, so they line up perfectly. Pair with the **Halo Table Lamp** to carry the same warm 3000 K glow from garden to living room.',
        },
      ],
      reviews: [
        {
          id: 'terra-en-1',
          name: 'Claire H.',
          location: 'Bath',
          rating: 5,
          title: 'Exactly what our front path needed',
          text: 'We ordered two sets — four lights in total — to line our garden path and they look absolutely brilliant. Dead easy to install, they were lit up the very first evening. The anthracite finish is smart and weather-resistant. Already thinking about a third set for the back gate.',
          date: '2026-04-22',
          product: 'Terra Solar Path Light',
          verifiedPurchase: true,
          helpfulCount: 34,
          topics: ['installation', 'design'],
        },
        {
          id: 'terra-en-2',
          name: 'James O.',
          location: 'Edinburgh',
          rating: 5,
          title: 'Survived a full Scottish winter',
          text: 'I was sceptical about solar this far north but they charged enough during the longer spring days and have been rock-solid since. Both units still running strong after six months outdoors. The auto dusk-to-dawn feature means I genuinely never think about them.',
          date: '2026-05-09',
          product: 'Terra Solar Path Light',
          verifiedPurchase: true,
          helpfulCount: 21,
          topics: ['durability', 'weather'],
        },
        {
          id: 'terra-en-3',
          name: 'Sophie R.',
          location: 'Norwich',
          rating: 4,
          title: 'Great lights, wish the runtime were longer in winter',
          text: 'Really happy with the build quality and the warm colour temperature — much nicer than the harsh blue-white you get from cheaper solar lights. Four stars only because in midwinter the short daylight means they sometimes switch off a bit early. Totally expected for solar, just worth knowing.',
          date: '2026-03-15',
          product: 'Terra Solar Path Light',
          verifiedPurchase: true,
          helpfulCount: 11,
          topics: ['light-quality', 'runtime'],
        },
      ],
    },
    ro: {
      shortName: 'Stâlpi Solari Terra',
      fullTitle: 'Terra — Stâlpi Solari de Alee (Set de 2) — Aluminiu Antracit IP65',
      tagline: 'Iluminat solar de alee fără cabluri, set de 2',
      shortDescription:
        'Set de 2 stâlpi solari de grădină din aluminiu vopsit în pulbere antracit. Înfigi știftul în sol, iar ei se aprind singuri la căderea nopții — fără cabluri, fără electrician, fără costuri de funcționare.',
      badge: 'Cu panou solar',
      availabilityNote: 'În stoc — se livrează în 2–4 zile lucrătoare',
      breadcrumb: [
        { label: 'Prima pagină', href: '/' },
        { label: 'Exterior', href: '/outdoor' },
      ],
      categoryLink: { label: 'Exterior', href: '/outdoor' },
      gallery: [
        { src: '/images/terra-path-light/1.jpg', label: 'Stâlpi Solari Terra — vedere frontală a setului de 2', aspect: '1/1' },
        { src: '/images/terra-path-light/2.jpg', label: 'Stâlpi Solari Terra — detaliu panou solar și știft de sol', aspect: '1/1' },
        { src: '/images/terra-path-light/3.jpg', label: 'Stâlpi Solari Terra — alee de grădină la amurg', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'Stâlpii solari **Terra** aduc o lumină caldă, aurie pe orice alee de grădină — automat, în fiecare seară, fără niciun cablu. Acest **set de 2** stâlpi antracit se încarcă în tăcere pe parcursul zilei și se aprind singuri la amurg, stingându-se la răsărit. Niciun electrician, nicio săpătură, niciun cost de funcționare.',
        },
        { kind: 'heading', text: 'Zero cabluri — înfigi și gata' },
        {
          kind: 'paragraph',
          body: 'Fiecare stâlp vine complet asamblat. Înfigi **știftul de sol din inox** în pământ sau pietriș, orientezi panoul solar spre cer și ai terminat. Repoziționarea sezonieră durează sub un minut — ridici, muți, înfigi. **Setul de 2** îți oferă imediat simetrie la intrarea pe alee sau la distanță egală pe un traseu mai lung.',
        },
        { kind: 'heading', text: 'Construită să dureze' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Aluminiu antracit IP65, rezistent la intemperii',
              description:
                'Corpul este din aluminiu turnat, cu un finisaj antracit dur în pulbere electrostatică — rezistent la decolorare UV, ploaie, îngheț și aer sărat de coastă. Clasa IP65 înseamnă că nici praful, nici un jet de apă nu îl afectează.',
            },
            {
              title: 'Senzor automat crepuscular',
              description:
                'Un senzor de lumină ambiantă de precizie aprinde LED-ul alb cald de 3000 K la căderea nopții și îl stinge la răsărit, în fiecare zi. Niciun timer de setat, nicio aplicație de configurat — funcționează și punct.',
            },
            {
              title: 'Acumulator înlocuibil — autonomie ~8 ore',
              description:
                'Acumulatorul reîncărcabil integrat oferă până la **8 ore de lumină** după o zi însorită completă. Compartimentul este accesibil utilizatorului, deci poți înlocui acumulatorul peste ani, fără să cumperi un stâlp nou.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/terra-path-light/2.jpg',
            label: 'Prim-plan cu panoul solar superior și știftul de sol din inox',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specificații' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Aluminiu vopsit în pulbere, IP65' },
            { label: 'Conținut set', value: 'Set de 2 stâlpi de alee + știfturi de sol' },
            { label: 'Dimensiuni', value: 'Înălțime ~40 cm, cap Ø 8 cm' },
            { label: 'Greutate', value: '0,6 kg per unitate' },
            { label: 'Lumină', value: 'LED alb cald 3000 K' },
            { label: 'Alimentare', value: 'Panou solar integrat + acumulator reîncărcabil' },
            { label: 'Autonomie', value: 'Până la 8 ore după încărcare completă' },
            { label: 'Senzor', value: 'Crepuscular automat (dusk-to-dawn)' },
            { label: 'Garanție', value: '2 ani' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Pentru o alee mai lungă sau o bordură completă de grădină, comandă pur și simplu mai multe seturi — finisajul antracit și temperatura de culoare alb cald sunt identice de la un set la altul, deci se aliniază perfect. Asociază-i cu **Lampa de Masă Halo** pentru a continua aceeași lumină caldă de 3000 K din grădină în living.',
        },
      ],
      reviews: [
        {
          id: 'terra-ro-1',
          name: 'Mihaela C.',
          location: 'Cluj-Napoca',
          rating: 5,
          title: 'Exact ce căutam pentru aleea din față',
          text: 'Am comandat două seturi — patru stâlpi în total — ca să bordelez aleea principală și arată superb. Instalarea a durat literalmente cinci minute. S-au aprins chiar în prima seară, fără să fac absolut nimic. Deja mă gândesc să mai iau un set pentru poarta din spate.',
          date: '2026-04-25',
          product: 'Stâlpi Solari Terra',
          verifiedPurchase: true,
          helpfulCount: 38,
          topics: ['instalare', 'design'],
        },
        {
          id: 'terra-ro-2',
          name: 'Bogdan T.',
          location: 'Brașov',
          rating: 5,
          title: 'Au rezistat perfect la iarna de munte',
          text: 'La Brașov iarna e serioasă și mă așteptam să aibă probleme. Nimic — au funcționat fără întrerupere toată iarna, inclusiv pe ger de −15°C. Finisajul antracit nu s-a coroit deloc și lumina caldă e mult mai plăcută decât albul rece al altor stâlpi solari pe care i-am mai încercat.',
          date: '2026-03-18',
          product: 'Stâlpi Solari Terra',
          verifiedPurchase: true,
          helpfulCount: 29,
          topics: ['durabilitate', 'vreme'],
        },
        {
          id: 'terra-ro-3',
          name: 'Elena V.',
          location: 'Iași',
          rating: 4,
          title: 'Foarte buni, autonomia scade ușor pe timp noros',
          text: 'Calitatea construcției este excelentă și lumina caldă de 3000 K dă un ambient deosebit aleii. Dau patru stele pentru că în zilele foarte înnorate de noiembrie autonomia scade la vreo 5–6 ore. E normal pentru solar, merită menționat. Pe vreme bună, cele 8 ore se respectă cu ușurință.',
          date: '2026-05-03',
          product: 'Stâlpi Solari Terra',
          verifiedPurchase: true,
          helpfulCount: 14,
          topics: ['calitate-lumină', 'autonomie'],
        },
      ],
    },
  },
});
