import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'lumen-floor-lamp',
  category: 'lighting',
  business: {
    inStock: true,
    reviewsKey: 'lumen-floor-lamp',
    crossSellSlugs: ['halo-table-lamp'],
    popularSlugs: ['oslo-nightstand', 'terra-path-light'],
    price: 159, currency: 'EUR'
  },
  content: {
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
  }
});
