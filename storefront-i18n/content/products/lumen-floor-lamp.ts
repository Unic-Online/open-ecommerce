import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'lumen-floor-lamp',
  category: 'lighting',
  business: {
    inStock: true,
    reviewsKey: 'lumen-floor-lamp',
    crossSellSlugs: ['halo-table-lamp'],
    popularSlugs: ['oslo-nightstand', 'terra-path-light'],
    prices: {
      english: { price: 159, currency: 'EUR' },
      ro: { price: 799, currency: 'RON' },
    },
  },
  locales: {
    en: {
      shortName: 'Lumen Floor Lamp',
      fullTitle: 'Lumen Floor Lamp — Matte Black Arc Floor Lamp with Marble Base',
      tagline: 'Arc floor lamp with marble base',
      shortDescription:
        'A sweeping matte-black arc floor lamp with a genuine marble counterweight base, natural linen drum shade and a foot-operated dimmer. Reaches light over a sofa or reading chair without touching the ceiling.',
      availabilityNote: 'In stock — ships in 2–4 business days',
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Lighting', href: '/lighting' },
      ],
      categoryLink: { label: 'Lighting', href: '/lighting' },
      gallery: [
        { src: '/images/lumen-floor-lamp/1.jpg', label: 'Lumen Floor Lamp — front view', aspect: '1/1' },
        { src: '/images/lumen-floor-lamp/2.jpg', label: 'Lumen Floor Lamp — marble base and foot dimmer detail', aspect: '1/1' },
        { src: '/images/lumen-floor-lamp/3.jpg', label: 'Lumen Floor Lamp — arching over a reading chair', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'The **Lumen Floor Lamp** does something a ceiling fixture cannot: it reaches its arc directly over a sofa or reading chair, pouring **warm, focused light** exactly where you need it without a single hole drilled overhead. One graceful sweep of **matte black powder-coated steel** carries a **natural linen drum shade** from floor level to reading height, making it the defining piece in any living room corner.',
        },
        { kind: 'heading', text: 'Stable base, effortless control' },
        {
          kind: 'paragraph',
          body: 'The **genuine marble counterweight base** — 28 cm across and solidly weighted — keeps the lamp planted even when the arc extends at full reach. No wobble, no tipping risk. Control the mood without leaving your seat: a **foot-operated dimmer switch** is wired into the cable, letting you step from bright reading light to a soft ambient glow in one smooth motion.',
        },
        { kind: 'heading', text: 'Built to last' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Matte black powder-coated steel arc',
              description:
                'The arc stem is formed from thick-gauge steel and finished with an electrostatic powder coat that resists scratches, fingerprints and the fading that plagues cheaper painted finishes.',
            },
            {
              title: 'Genuine marble counterweight base',
              description:
                'Each base is cut from natural marble, so the veining and tone are unique. The weight provides real stability — no filler, no hollow casting.',
            },
            {
              title: 'Natural linen shade',
              description:
                'The drum shade is wrapped in tightly woven natural linen that diffuses light evenly and adds organic warmth to the otherwise graphic silhouette of the lamp.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/lumen-floor-lamp/2.jpg',
            label: 'Close-up of the marble base and foot dimmer switch',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specifications' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Powder-coated steel arc, natural marble base, linen drum shade' },
            { label: 'Dimensions', value: 'Height ~165 cm, reach ~95 cm, base diameter ~28 cm' },
            { label: 'Weight', value: '7.2 kg' },
            { label: 'Bulb', value: 'E27, max 40 W (LED recommended)' },
            { label: 'Switch', value: 'Foot-operated dimmer' },
            { label: 'Cable length', value: '2 m (including in-line dimmer)' },
            { label: 'Warranty', value: '2 years' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Pair the Lumen with the **Halo Table Lamp** — both belong to the same lighting family, sharing a black-and-natural palette — and you have a cohesive lighting layer across the whole room. Together they sit beautifully on either side of a sofa, creating a reading-ready setup that feels considered rather than assembled.',
        },
      ],
      reviews: [
        {
          id: 'lumen-en-1',
          name: 'Claire H.',
          location: 'Edinburgh',
          rating: 5,
          title: 'Finally a floor lamp that doesn\'t tip over',
          text: 'The marble base is proper heavy — it\'s not going anywhere. The linen shade gives a much softer light than I expected, really flattering in the evenings. The foot dimmer is brilliantly placed; I use it constantly without thinking about it.',
          date: '2026-03-14',
          product: 'Lumen Floor Lamp',
          verifiedPurchase: true,
          helpfulCount: 34,
          topics: ['stability', 'dimmer'],
        },
        {
          id: 'lumen-en-2',
          name: 'Tom B.',
          location: 'Bristol',
          rating: 5,
          title: 'Looks like a design shop piece',
          text: 'I spent weeks looking for an arc lamp that wasn\'t either plasticky or absurdly expensive. This is the one. The matte black finish is properly matte, the marble base is gorgeous and unique — mine has a lovely grey-green vein through it. Assembly took about fifteen minutes.',
          date: '2026-04-02',
          product: 'Lumen Floor Lamp',
          verifiedPurchase: true,
          helpfulCount: 21,
          topics: ['design', 'finish'],
        },
        {
          id: 'lumen-en-3',
          name: 'Yasmin O.',
          location: 'Manchester',
          rating: 4,
          title: 'Great lamp, instructions could be clearer',
          text: 'The lamp itself is beautiful — really changes the feel of my reading corner. Took off one star because the assembly diagram was a little cryptic, but once it clicked it was fine. Light output through the linen shade is warm and inviting rather than harsh.',
          date: '2026-05-10',
          product: 'Lumen Floor Lamp',
          verifiedPurchase: true,
          helpfulCount: 9,
          topics: ['assembly', 'light quality'],
        },
      ],
    },
    ro: {
      shortName: 'Lampadar Lumen',
      fullTitle: 'Lampadar Lumen — Lampadar Arc Negru Mat cu Bază din Marmură',
      tagline: 'Lampadar arc cu bază din marmură',
      shortDescription:
        'Un lampadar arc cu tijă neagră mată, bază autentică din marmură, abajur cilindric din in natural și comutator de intensitate acționat cu piciorul. Se arcuiește deasupra canapelei sau fotoliului de lectură fără să atingă tavanul.',
      availabilityNote: 'În stoc — se livrează în 2–4 zile lucrătoare',
      breadcrumb: [
        { label: 'Prima pagină', href: '/' },
        { label: 'Iluminat', href: '/lighting' },
      ],
      categoryLink: { label: 'Iluminat', href: '/lighting' },
      gallery: [
        { src: '/images/lumen-floor-lamp/1.jpg', label: 'Lampadar Lumen — vedere frontală', aspect: '1/1' },
        { src: '/images/lumen-floor-lamp/2.jpg', label: 'Lampadar Lumen — detaliu bază marmură și comutator picior', aspect: '1/1' },
        { src: '/images/lumen-floor-lamp/3.jpg', label: 'Lampadar Lumen — arcuit deasupra unui fotoliu de lectură', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: '**Lampadarul Lumen** face ceva ce un spot de tavan nu poate: se arcuiește direct deasupra canapelei sau fotoliului de lectură, oferind **lumină caldă și focalizată** exact acolo unde ai nevoie, fără niciun șurub în tavan. O singură curbă elegantă de **oțel vopsit mat în negru** poartă un **abajur cilindric din in natural** de la nivelul podelei până la înălțimea ideală de citit, devenind piesa definitorie a oricărui colț de living.',
        },
        { kind: 'heading', text: 'Bază stabilă, control fără efort' },
        {
          kind: 'paragraph',
          body: '**Baza autentică din marmură** — 28 cm diametru și solid grea — menține lampadarul ferm ancorat chiar și atunci când arcul este extins la maximum. Nicio oscilație, niciun risc de răsturnare. Controlează atmosfera fără să te ridici de pe canapea: un **comutator de intensitate acționat cu piciorul** este integrat direct în cablu, lăsându-te să treci de la o lumină puternică de lectură la o ambianță calmă dintr-o singură mișcare.',
        },
        { kind: 'heading', text: 'Construită să dureze' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Arc din oțel vopsit electrostatic mat negru',
              description:
                'Tija arc este formată din oțel cu perete gros și finisată cu un strat electrostatic de pulbere care rezistă la zgârieturi, amprente și decolorarea specifică finisajelor vopsite mai ieftine.',
            },
            {
              title: 'Bază autentică din marmură, contragreutate reală',
              description:
                'Fiecare bază este tăiată din marmură naturală, astfel că venele și tonul sunt unice. Greutatea asigură o stabilitate reală — fără umplutură, fără turnare goală.',
            },
            {
              title: 'Abajur din in natural',
              description:
                'Abajurul cilindric este învelit în in natural țesut strâns, care difuzează lumina uniform și adaugă căldură organică siluetei altfel grafice a lampadarului.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/lumen-floor-lamp/2.jpg',
            label: 'Prim-plan cu baza din marmură și comutatorul de intensitate pentru picior',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specificații' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Arc din oțel vopsit electrostatic, bază din marmură naturală, abajur din in' },
            { label: 'Dimensiuni', value: 'Înălțime ~165 cm, rază de acoperire ~95 cm, diametru bază ~28 cm' },
            { label: 'Greutate', value: '7,2 kg' },
            { label: 'Bec', value: 'E27, max 40 W (recomandat LED)' },
            { label: 'Comutator', value: 'Dimmer acționat cu piciorul' },
            { label: 'Lungime cablu', value: '2 m (inclusiv dimmer-ul integrat)' },
            { label: 'Garanție', value: '2 ani' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Asociază Lumen cu **Lampa de Masă Halo** — ambele fac parte din aceeași familie de iluminat, împărțind o paletă negru-și-natural — și vei obține un strat de lumină coerent în întreaga cameră. Împreună arată superb de o parte și de alta a unei canapele, creând un setup gata de lectură care pare gândit, nu asamblat la întâmplare.',
        },
      ],
      reviews: [
        {
          id: 'lumen-ro-1',
          name: 'Andreea V.',
          location: 'București',
          rating: 5,
          title: 'În sfârșit un lampadar care nu se răstoarnă',
          text: 'Baza din marmură este serios grea — nu se mișcă nicăieri. Abajurul din in dă o lumină mult mai moale decât mă așteptam, cu adevărat flatantă seara. Dimmmer-ul de picior e plasat perfect; îl folosesc constant fără să mă gândesc la el.',
          date: '2026-03-18',
          product: 'Lampadar Lumen',
          verifiedPurchase: true,
          helpfulCount: 38,
          topics: ['stabilitate', 'dimmer'],
        },
        {
          id: 'lumen-ro-2',
          name: 'Mihai C.',
          location: 'Cluj-Napoca',
          rating: 5,
          title: 'Arată ca dintr-un showroom de design',
          text: 'Am căutat săptămâni întregi un lampadar arc care să nu fie nici ieftin-plastic, nici absurd de scump. Acesta este cel potrivit. Finisajul negru mat este cu adevărat mat, baza din marmură este frumoasă și unică — a mea are o venă gri-verde superbă. Montajul a durat vreo cincisprezece minute.',
          date: '2026-04-08',
          product: 'Lampadar Lumen',
          verifiedPurchase: true,
          helpfulCount: 24,
          topics: ['design', 'finisaj'],
        },
        {
          id: 'lumen-ro-3',
          name: 'Ioana S.',
          location: 'Timișoara',
          rating: 4,
          title: 'Lampadar excelent, instrucțiunile puteau fi mai clare',
          text: 'Lampadarul în sine este splendid — schimbă cu adevărat atmosfera colțului meu de lectură. Am dat un punct mai puțin pentru că diagrama de montaj era puțin criptică, dar odată ce am prins ideea a fost simplu. Lumina prin abajurul din in este caldă și primitoare, nu aspră.',
          date: '2026-05-15',
          product: 'Lampadar Lumen',
          verifiedPurchase: true,
          helpfulCount: 11,
          topics: ['montaj', 'calitate lumină'],
        },
      ],
    },
  },
});
