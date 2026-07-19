import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'oslo-nightstand',
  category: 'furniture',
  business: {
    inStock: true,
    reviewsKey: 'oslo-nightstand',
    upsellSlug: 'aria-console',
    crossSellSlugs: ['aria-console'],
    popularSlugs: ['halo-table-lamp', 'terra-path-light'],
    prices: {
      english: { price: 149, oldPrice: 199, currency: 'EUR' },
      ro: { price: 749, oldPrice: 999, currency: 'RON' },
    },
  },
  locales: {
    en: {
      shortName: 'Oslo Nightstand',
      fullTitle: 'Oslo Nightstand — Solid Oak Bedside Table with Push-to-Open Drawer',
      tagline: 'Minimal oak bedside table',
      shortDescription:
        'A minimal solid-oak nightstand with a single push-to-open drawer, softly rounded edges and a hand-oiled finish. Slim enough for tight bedrooms, warm enough to anchor the whole room.',
      badge: 'Best seller',
      availabilityNote: 'In stock — ships in 2–4 business days',
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Furniture', href: '/furniture' },
      ],
      categoryLink: { label: 'Furniture', href: '/furniture' },
      gallery: [
        { src: '/images/oslo-nightstand/1.jpg', label: 'Oslo Nightstand — front view in oak', aspect: '1/1' },
        { src: '/images/oslo-nightstand/2.jpg', label: 'Oslo Nightstand — push-to-open drawer detail', aspect: '1/1' },
        { src: '/images/oslo-nightstand/3.jpg', label: 'Oslo Nightstand — styled beside a bed', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'The **Oslo Nightstand** strips the bedside table back to its essentials: a single warm block of **solid European oak**, one quiet drawer, and edges rounded just enough to feel friendly in the dark. No handles to catch a sleeve, no gloss to fingerprint — just honest wood that gets better with age.',
        },
        { kind: 'heading', text: 'Push-to-open, handle-free' },
        {
          kind: 'paragraph',
          body: 'A concealed **push-to-open** mechanism lets the drawer glide out with a light tap — no knobs, no pulls, nothing to break the clean front face. The drawer rides on **soft-close runners** so it never slams, even at 2 a.m.',
        },
        { kind: 'heading', text: 'Built to last' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Solid oak, not veneer',
              description:
                'Every panel is FSC-certified solid oak, finished with a natural hard-wax oil that you can refresh at home instead of replacing the piece.',
            },
            {
              title: 'Rounded, child-safe edges',
              description:
                'All four corners are hand-radiused so there are no sharp edges at toddler height — and nothing to bruise a hip on the way to bed.',
            },
            {
              title: 'Felt-lined drawer',
              description:
                'The drawer base is lined with soft grey felt so glasses, a phone and a book stay put and scratch-free.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/oslo-nightstand/2.jpg',
            label: 'Close-up of the push-to-open drawer and rounded oak edge',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specifications' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Solid European oak, hard-wax oil finish' },
            { label: 'Dimensions', value: '45 × 40 × 42 cm (W × D × H)' },
            { label: 'Drawer', value: 'Single, push-to-open, soft-close runners' },
            { label: 'Weight', value: '9.5 kg' },
            { label: 'Max top load', value: '15 kg' },
            { label: 'Assembly', value: 'Legs attach with 4 bolts — under 10 minutes' },
            { label: 'Warranty', value: '5 years' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Pair it with the **Aria Console Table** for a matching oak grain through the hallway, or top it with the **Halo Table Lamp** for a soft reading glow.',
        },
      ],
      reviews: [
        {
          id: 'oslo-en-1',
          name: 'Hannah W.',
          location: 'Bristol',
          rating: 5,
          title: 'Beautiful wood, even nicer in person',
          text: 'The oak grain is gorgeous and the push-to-open drawer feels properly engineered, not gimmicky. It took me about eight minutes to attach the legs. Looks far more expensive than it was.',
          date: '2026-04-18',
          product: 'Oslo Nightstand',
          verifiedPurchase: true,
          helpfulCount: 27,
          topics: ['quality', 'assembly'],
        },
        {
          id: 'oslo-en-2',
          name: 'Marcus T.',
          location: 'Leeds',
          rating: 5,
          title: 'Perfect for a small bedroom',
          text: 'I needed something slim that did not crowd the bed and this is exactly it. The felt-lined drawer is a lovely touch — my glasses and phone fit with room to spare.',
          date: '2026-03-30',
          product: 'Oslo Nightstand',
          verifiedPurchase: true,
          helpfulCount: 14,
          topics: ['size', 'storage'],
        },
        {
          id: 'oslo-en-3',
          name: 'Priya N.',
          location: 'Manchester',
          rating: 4,
          title: 'Lovely, wish it came in walnut',
          text: 'No complaints about quality at all — solid and well finished. Only reason for four stars is I would have loved a darker walnut option to match my bed frame.',
          date: '2026-05-02',
          product: 'Oslo Nightstand',
          verifiedPurchase: true,
          helpfulCount: 6,
          topics: ['finish'],
        },
      ],
    },
    ro: {
      shortName: 'Noptiera Oslo',
      fullTitle: 'Noptiera Oslo — Noptieră din Stejar Masiv cu Sertar Push-to-Open',
      tagline: 'Noptieră minimalistă din stejar',
      shortDescription:
        'Noptieră minimalistă din stejar masiv, cu un singur sertar push-to-open, muchii rotunjite fin și finisaj uleiat manual. Suficient de îngustă pentru dormitoare mici, suficient de caldă cât să dea ton întregii camere.',
      badge: 'Cel mai vândut',
      availabilityNote: 'În stoc — se livrează în 2–4 zile lucrătoare',
      breadcrumb: [
        { label: 'Prima pagină', href: '/' },
        { label: 'Mobilier', href: '/furniture' },
      ],
      categoryLink: { label: 'Mobilier', href: '/furniture' },
      gallery: [
        { src: '/images/oslo-nightstand/1.jpg', label: 'Noptiera Oslo — vedere frontală din stejar', aspect: '1/1' },
        { src: '/images/oslo-nightstand/2.jpg', label: 'Noptiera Oslo — detaliu sertar push-to-open', aspect: '1/1' },
        { src: '/images/oslo-nightstand/3.jpg', label: 'Noptiera Oslo — amenajată lângă pat', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'Noptiera **Oslo** reduce noptiera la esență: un singur bloc cald de **stejar european masiv**, un sertar discret și muchii rotunjite exact cât trebuie ca să fie prietenoase pe întuneric. Fără mânere de care să-ți agăți mâneca, fără luciu care să rețină amprente — doar lemn autentic, care arată tot mai bine în timp.',
        },
        { kind: 'heading', text: 'Push-to-open, fără mânere' },
        {
          kind: 'paragraph',
          body: 'Un mecanism ascuns **push-to-open** lasă sertarul să alunece la o atingere ușoară — fără butoane, fără mânere, nimic care să strice fața curată a piesei. Sertarul culisează pe **ghidaje soft-close**, deci nu se trântește niciodată, nici la 2 noaptea.',
        },
        { kind: 'heading', text: 'Construită să dureze' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Stejar masiv, nu furnir',
              description:
                'Fiecare panou este din stejar masiv certificat FSC, finisat cu ulei de ceară tare pe care îl poți reîmprospăta acasă, fără să înlocuiești piesa.',
            },
            {
              title: 'Muchii rotunjite, sigure pentru copii',
              description:
                'Toate cele patru colțuri sunt rotunjite manual, deci nu există muchii ascuțite la înălțimea unui copil — și nimic de care să te lovești în drum spre pat.',
            },
            {
              title: 'Sertar căptușit cu fetru',
              description:
                'Baza sertarului este căptușită cu fetru gri moale, astfel încât ochelarii, telefonul și o carte rămân la locul lor, fără zgârieturi.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/oslo-nightstand/2.jpg',
            label: 'Prim-plan cu sertarul push-to-open și muchia rotunjită din stejar',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specificații' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Stejar european masiv, finisaj cu ulei de ceară' },
            { label: 'Dimensiuni', value: '45 × 40 × 42 cm (L × A × Î)' },
            { label: 'Sertar', value: 'Unul, push-to-open, ghidaje soft-close' },
            { label: 'Greutate', value: '9,5 kg' },
            { label: 'Sarcină maximă blat', value: '15 kg' },
            { label: 'Asamblare', value: 'Picioarele se prind cu 4 șuruburi — sub 10 minute' },
            { label: 'Garanție', value: '5 ani' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Combin-o cu **Consola Aria** pentru un fir de stejar asortat în hol sau adaugă deasupra **Lampa de Masă Halo** pentru o lumină caldă de citit.',
        },
      ],
      reviews: [
        {
          id: 'oslo-ro-1',
          name: 'Andreea M.',
          location: 'București',
          rating: 5,
          title: 'Lemn superb, și mai frumos pe viu',
          text: 'Fibra stejarului este superbă, iar sertarul push-to-open pare gândit serios, nu de fițe. Am prins picioarele în vreo opt minute. Arată mult mai scump decât a costat.',
          date: '2026-04-20',
          product: 'Noptiera Oslo',
          verifiedPurchase: true,
          helpfulCount: 31,
          topics: ['calitate', 'asamblare'],
        },
        {
          id: 'oslo-ro-2',
          name: 'Radu P.',
          location: 'Cluj-Napoca',
          rating: 5,
          title: 'Perfectă pentru un dormitor mic',
          text: 'Aveam nevoie de ceva îngust care să nu aglomereze patul și exact asta este. Sertarul căptușit cu fetru e un detaliu plăcut — ochelarii și telefonul încap lejer.',
          date: '2026-03-28',
          product: 'Noptiera Oslo',
          verifiedPurchase: true,
          helpfulCount: 12,
          topics: ['dimensiuni', 'depozitare'],
        },
        {
          id: 'oslo-ro-3',
          name: 'Ioana D.',
          location: 'Timișoara',
          rating: 4,
          title: 'Frumoasă, mi-aș fi dorit și nuc',
          text: 'Nicio plângere legată de calitate — solidă și bine finisată. Singurul motiv pentru patru stele este că mi-aș fi dorit o variantă de nuc mai închis, să se asorteze cu patul.',
          date: '2026-05-04',
          product: 'Noptiera Oslo',
          verifiedPurchase: true,
          helpfulCount: 5,
          topics: ['finisaj'],
        },
      ],
    },
  },
});
