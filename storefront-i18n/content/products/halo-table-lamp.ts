import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'halo-table-lamp',
  category: 'lighting',
  business: {
    inStock: true,
    reviewsKey: 'halo-table-lamp',
    upsellSlug: 'lumen-floor-lamp',
    crossSellSlugs: ['lumen-floor-lamp'],
    popularSlugs: ['oslo-nightstand', 'aria-console'],
    prices: {
      english: { price: 89, oldPrice: 119, currency: 'EUR' },
      ro: { price: 449, oldPrice: 599, currency: 'RON' },
    },
  },
  locales: {
    en: {
      shortName: 'Halo Table Lamp',
      fullTitle: 'Halo Table Lamp — Dimmable Opal Glass Sphere with Brushed Brass Base',
      tagline: 'Warm glow, effortless dimming',
      shortDescription:
        'An opal glass sphere diffuser on a solid brushed-brass base, with a stepless touch dimmer that remembers your last setting. Equal parts bedside companion, desk accent and sideboard statement.',
      badge: 'Best seller',
      availabilityNote: 'In stock — ships in 2–4 business days',
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Lighting', href: '/lighting' },
      ],
      categoryLink: { label: 'Lighting', href: '/lighting' },
      gallery: [
        { src: '/images/halo-table-lamp/1.jpg', label: 'Halo Table Lamp — front view', aspect: '1/1' },
        { src: '/images/halo-table-lamp/2.jpg', label: 'Halo Table Lamp — brass base and touch dimmer detail', aspect: '1/1' },
        { src: '/images/halo-table-lamp/3.jpg', label: 'Halo Table Lamp — lifestyle on a nightstand', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'The **Halo Table Lamp** distils everything a good lamp should be into a single gesture: a hand-blown **opal glass sphere** that diffuses warm LED light without a single hot spot, mounted on a weighty **brushed brass base** that stays put. One touch dims it up or down. Another holds the mood exactly where you left it.',
        },
        { kind: 'heading', text: 'Light that responds to a touch' },
        {
          kind: 'paragraph',
          body: 'A capacitive **touch dimmer** built into the base lets you cycle through full brightness, a warm reading glow and a whisper-soft nightlight — no switches to fumble in the dark. The **3-stage memory** stores your last setting so the lamp comes on exactly the way you left it.',
        },
        { kind: 'heading', text: 'Built to last' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Hand-blown opal glass',
              description:
                'Each sphere is mouth-blown from borosilicate opal glass, giving the diffuser a naturally uneven milky texture that softens light evenly across the whole room.',
            },
            {
              title: 'Solid brushed brass base',
              description:
                'The weighted base is turned from solid brass and hand-brushed to a matte satin finish that ages gracefully — no lacquer to peel, no chrome to chip.',
            },
            {
              title: 'Stepless touch dimmer with memory',
              description:
                'Hold a finger on the base to slide smoothly through the full brightness range; tap once to recall your saved level. Compatible with all standard EU and UK sockets.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/halo-table-lamp/2.jpg',
            label: 'Close-up of the brushed brass base and touch-dimmer ring',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specifications' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Hand-blown opal borosilicate glass, solid brushed brass base' },
            { label: 'Dimensions', value: '20 cm diameter × 30 cm height' },
            { label: 'Bulb', value: 'Integrated LED ~6 W, 2700 K warm white' },
            { label: 'Dimming', value: 'Stepless touch, 3-stage memory' },
            { label: 'Cable length', value: '180 cm fabric-braided, brass plug' },
            { label: 'Weight', value: '1.4 kg' },
            { label: 'Warranty', value: '2 years' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Looking to carry the same warm brass accent across the whole room? Step up to the **Lumen Floor Lamp** — a matching family piece with the same opal globe and brass finish, tall enough to anchor a reading corner. Or place the Halo directly on the **Oslo Nightstand** for a bedside pairing where every material feels considered.',
        },
      ],
      reviews: [
        {
          id: 'halo-en-1',
          name: 'Sophie R.',
          location: 'Edinburgh',
          rating: 5,
          title: 'Perfect bedside lamp — worth every penny',
          text: 'I was hesitant at the price but this lamp is genuinely beautiful in person. The opal glass gives the most flattering, even glow — no harsh spots at all. The touch dimmer is satisfyingly responsive and the memory function means it comes on at my reading brightness every night without me having to fiddle. Looks brilliant on my Oslo Nightstand.',
          date: '2026-04-12',
          product: 'Halo Table Lamp',
          verifiedPurchase: true,
          helpfulCount: 34,
          topics: ['quality', 'dimmer'],
        },
        {
          id: 'halo-en-2',
          name: 'Oliver M.',
          location: 'Bristol',
          rating: 5,
          title: 'The brass base alone is worth it',
          text: 'Everything about this feels premium — the weight of the base, the texture of the glass, the braided cable. I have it on a sideboard in the living room and guests always ask about it. The dimmer is intuitive once you get the hang of it: tap for saved level, hold to adjust.',
          date: '2026-03-22',
          product: 'Halo Table Lamp',
          verifiedPurchase: true,
          helpfulCount: 21,
          topics: ['design', 'quality'],
        },
        {
          id: 'halo-en-3',
          name: 'Chloe T.',
          location: 'Leeds',
          rating: 4,
          title: 'Beautiful light, cable slightly short for my setup',
          text: 'Stunning lamp and the opal globe really does diffuse light perfectly — no glare at all. The only reason for four stars is that 180 cm of cable was just barely enough to reach my socket behind the bed. Everything else is flawless.',
          date: '2026-05-08',
          product: 'Halo Table Lamp',
          verifiedPurchase: true,
          helpfulCount: 9,
          topics: ['design', 'setup'],
        },
      ],
    },
    ro: {
      shortName: 'Lampa de Masă Halo',
      fullTitle: 'Lampa de Masă Halo — Sferă din Sticlă Opală cu Bază din Alamă Periată, Reglabilă',
      tagline: 'Lumină caldă, reglaj la atingere',
      shortDescription:
        'O sferă difuzoare din sticlă opală pe o bază solidă din alamă periată, cu un dimmer tactil continuu care îți memorează ultima setare. Perfectă pe noptieră, pe birou sau pe o consolă.',
      badge: 'Cel mai vândut',
      availabilityNote: 'În stoc — se livrează în 2–4 zile lucrătoare',
      breadcrumb: [
        { label: 'Prima pagină', href: '/' },
        { label: 'Iluminat', href: '/lighting' },
      ],
      categoryLink: { label: 'Iluminat', href: '/lighting' },
      gallery: [
        { src: '/images/halo-table-lamp/1.jpg', label: 'Lampa de Masă Halo — vedere frontală', aspect: '1/1' },
        { src: '/images/halo-table-lamp/2.jpg', label: 'Lampa de Masă Halo — detaliu bază alamă și dimmer tactil', aspect: '1/1' },
        { src: '/images/halo-table-lamp/3.jpg', label: 'Lampa de Masă Halo — ambianță pe noptieră', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: '**Lampa de Masă Halo** reduce esența unei lămpi bune la un singur gest: o **sferă din sticlă opală** suflată manual, care difuzează lumina LED caldă fără niciun punct supraluminat, montată pe o **bază din alamă periată** cu greutate suficientă cât să rămână stabilă. O atingere o reglează. O altă atingere o aduce exact acolo unde ai lăsat-o.',
        },
        { kind: 'heading', text: 'Lumină care răspunde la atingere' },
        {
          kind: 'paragraph',
          body: 'Un **dimmer tactil** capacitiv integrat în bază îți permite să treci prin luminozitate maximă, o lumină caldă de citit și o luminiță discretă de noapte — fără întrerupătoare de căutat pe întuneric. **Memoria în 3 trepte** păstrează ultima setare aleasă, astfel încât lampa pornește întotdeauna exact cum ai lăsat-o.',
        },
        { kind: 'heading', text: 'Construită să dureze' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Sticlă opală suflată manual',
              description:
                'Fiecare sferă este suflată manual din sticlă borosilicată opală, dând difuzorului o textură lăptoasă natural neuniformă care înmoaie lumina uniform în toată camera.',
            },
            {
              title: 'Bază solidă din alamă periată',
              description:
                'Baza cu greutate este torneată din alamă solidă și periată manual la un finisaj satinat mat care îmbătrânește frumos — fără lac care să se cojească, fără crom care să se deterioreze.',
            },
            {
              title: 'Dimmer tactil continuu cu memorie',
              description:
                'Ține degetul pe bază pentru a parcurge continuu toată gama de luminozitate; apasă o dată pentru a reveni la nivelul salvat. Compatibilă cu toate prizele standard EU și RO.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/halo-table-lamp/2.jpg',
            label: 'Prim-plan cu baza din alamă periată și inelul dimmerului tactil',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specificații' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'Sticlă borosilicată opală suflată manual, bază din alamă solidă periată' },
            { label: 'Dimensiuni', value: '20 cm diametru × 30 cm înălțime' },
            { label: 'Bec', value: 'LED integrat ~6 W, 2700 K alb cald' },
            { label: 'Reglaj', value: 'Dimmer tactil continuu, memorie 3 trepte' },
            { label: 'Lungime cablu', value: '180 cm, împletit textil, ștecher alamă' },
            { label: 'Greutate', value: '1,4 kg' },
            { label: 'Garanție', value: '2 ani' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Vrei să duci același accent de alamă caldă prin toată camera? Treci la **Lampa de Podea Lumen** — un model din aceeași familie, cu același glob opal și același finisaj din alamă, suficient de înaltă cât să ancoreze un colț de lectură. Sau pune Halo direct pe **Noptiera Oslo** pentru un duo de noptieră în care fiecare material pare gândit împreună.',
        },
      ],
      reviews: [
        {
          id: 'halo-ro-1',
          name: 'Andreea V.',
          location: 'București',
          rating: 5,
          title: 'Cea mai frumoasă lampă pe care am cumpărat-o vreodată',
          text: 'Am ezitat la preț, dar lampa este cu adevărat superbă în realitate. Globul opal dă o lumină uniformă, caldă, fără niciun punct deranjant. Dimmerul tactil funcționează impecabil, iar memoria face ca lampa să pornească mereu la luminozitatea mea de citit, fără să umblu la ea. Arată perfect pe Noptiera Oslo.',
          date: '2026-04-15',
          product: 'Lampa de Masă Halo',
          verifiedPurchase: true,
          helpfulCount: 41,
          topics: ['calitate', 'design'],
        },
        {
          id: 'halo-ro-2',
          name: 'Mihai C.',
          location: 'Cluj-Napoca',
          rating: 5,
          title: 'Baza din alamă singură merită prețul',
          text: 'Tot ce ține de această lampă transmite premium — greutatea bazei, textura sticlei, cablul împletit. Am pus-o pe o consolă în living și toți musafirii întreabă de ea. Dimmerul devine intuitiv repede: apasă pentru nivel salvat, ține pentru reglaj continuu.',
          date: '2026-03-19',
          product: 'Lampa de Masă Halo',
          verifiedPurchase: true,
          helpfulCount: 28,
          topics: ['design', 'calitate'],
        },
        {
          id: 'halo-ro-3',
          name: 'Ioana S.',
          location: 'Iași',
          rating: 4,
          title: 'Lumină superbă, cablul puțin scurt pentru setup-ul meu',
          text: 'Lampa este uimitoare și globul opal difuzează lumina perfect — zero strălucire deranjantă. Singurul motiv pentru patru stele este că 180 cm de cablu au fost abia suficienți să ajungă la priza de după pat. Altfel, totul este impecabil.',
          date: '2026-05-10',
          product: 'Lampa de Masă Halo',
          verifiedPurchase: true,
          helpfulCount: 11,
          topics: ['design', 'instalare'],
        },
      ],
    },
  },
});
