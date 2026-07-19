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
    price: 89, oldPrice: 119, currency: 'EUR'
  },
  content: {
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
  }
});
