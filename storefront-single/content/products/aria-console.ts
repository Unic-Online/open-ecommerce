import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'aria-console',
  category: 'furniture',
  business: {
    inStock: true,
    reviewsKey: 'aria-console',
    crossSellSlugs: ['oslo-nightstand'],
    popularSlugs: ['halo-table-lamp', 'lumen-floor-lamp'],
    price: 249, oldPrice: 319, currency: 'EUR'
  },
  content: {
      shortName: 'Aria Console Table',
      fullTitle: 'Aria Console Table — White Lacquer Top with Solid Oak Legs and Shelf',
      tagline: 'Slim hallway console in oak and white',
      shortDescription:
        'A slim console table with a white lacquer top, solid oak legs and a lower oak shelf. At just 30 cm deep, it slips behind a sofa or into a hallway without crowding the room — and looks considered doing it.',
      badge: 'New',
      availabilityNote: 'In stock — ships in 2–4 business days',
      breadcrumb: [
        { label: 'Home', href: '/' },
        { label: 'Furniture', href: '/furniture' },
      ],
      categoryLink: { label: 'Furniture', href: '/furniture' },
      gallery: [
        { src: '/images/aria-console/1.jpg', label: 'Aria Console Table — front view', aspect: '1/1' },
        { src: '/images/aria-console/2.jpg', label: 'Aria Console Table — lower shelf and oak leg joint detail', aspect: '1/1' },
        { src: '/images/aria-console/3.jpg', label: 'Aria Console Table — styled in a hallway', aspect: '1/1' },
      ],
      description: [
        {
          kind: 'paragraph',
          lead: true,
          body: 'The **Aria Console Table** is built around one idea: give a hallway or sofa wall exactly the surface it needs, nothing more. A **white lacquer top** sits above four tapered **solid oak legs**, with a lower shelf that holds a book, a basket or a pair of shoes out of sight. At 30 cm deep it never intrudes — it simply belongs.',
        },
        { kind: 'heading', text: 'Slim by design, versatile by nature' },
        {
          kind: 'paragraph',
          body: 'At **110 × 30 × 80 cm**, Aria fits the gap between a door and a coat rack, slides behind a three-seat sofa without grazing a leg, or anchors a bare dining-room wall with a lamp and a small plant. The **matt white lacquer** resists fingerprints and cleans with a damp cloth — no coasters required. The **hand-oiled oak** on the legs and shelf ties it to every warm-toned room.',
        },
        { kind: 'heading', text: 'Built to last' },
        {
          kind: 'bulletList',
          items: [
            {
              title: 'Solid oak legs and shelf',
              description:
                'Both the four tapered legs and the lower shelf are turned from FSC-certified solid European oak, finished with a natural hard-wax oil you can refresh at home rather than replacing the piece.',
            },
            {
              title: 'Scratch-resistant lacquer top',
              description:
                'The white top panel is coated in a two-component polyurethane lacquer hardened to 3H pencil hardness — keys, mugs and mail will not mark it in daily use.',
            },
            {
              title: 'Mortise-and-tenon leg joints',
              description:
                'Each leg is attached with a traditional mortise-and-tenon joint reinforced by a steel cross-dowel bolt, so the table stays rigid on uneven floors without rocking or creaking over time.',
            },
          ],
        },
        {
          kind: 'image',
          image: {
            src: '/images/aria-console/2.jpg',
            label: 'Close-up of the lower oak shelf and mortise-and-tenon leg joint',
            aspect: '1/1',
          },
        },
        { kind: 'heading', text: 'Specifications' },
        {
          kind: 'specList',
          specs: [
            { label: 'Material', value: 'White lacquer top panel (3H coat); solid European oak legs and shelf, hard-wax oil finish' },
            { label: 'Dimensions', value: '110 × 30 × 80 cm (W × D × H)' },
            { label: 'Shelf', value: 'Fixed lower shelf, solid oak, 15 cm clearance from floor' },
            { label: 'Weight', value: '12 kg' },
            { label: 'Assembly', value: 'Legs attach with 4 cross-dowel bolts — under 15 minutes' },
            { label: 'Warranty', value: '5 years' },
          ],
        },
        {
          kind: 'paragraph',
          body: 'Pair it with the **Oslo Nightstand** — its matching hard-wax oak finish makes the two pieces read as a family across a bedroom and hallway. For the top, the **Halo Table Lamp** sits at the perfect height to cast a warm welcome glow by the front door.',
        },
      ],
      reviews: [
        {
          id: 'aria-en-1',
          name: 'Sophie R.',
          location: 'London',
          rating: 5,
          title: 'Finally, something slim enough for my hallway',
          text: 'I have tried three console tables in this spot and they all felt too deep or too chunky. The Aria is just right — 30 cm barely registers against the wall and the white top brightens the whole entrance. The oak legs are a lovely warm contrast. Assembly took about twelve minutes.',
          date: '2026-03-14',
          product: 'Aria Console Table',
          verifiedPurchase: true,
          helpfulCount: 34,
          topics: ['size', 'assembly'],
        },
        {
          id: 'aria-en-2',
          name: 'James O.',
          location: 'Edinburgh',
          rating: 5,
          title: 'Looks like a boutique piece, costs like a high-street one',
          text: 'The lacquer is flawless and the oak legs are genuinely solid — not hollow, not veneered. I have had it behind my sofa for two months and it has not moved a millimetre. The lower shelf is holding a small crate of vinyl records without complaint.',
          date: '2026-04-22',
          product: 'Aria Console Table',
          verifiedPurchase: true,
          helpfulCount: 21,
          topics: ['quality', 'storage'],
        },
        {
          id: 'aria-en-3',
          name: 'Clara B.',
          location: 'Bristol',
          rating: 4,
          title: 'Elegant and practical — minor gripe on packaging',
          text: 'Beautiful table and the white stays clean surprisingly well. Docking one star only because one corner of the top had a tiny dent in the foam — the lacquer itself was fine, thankfully. Customer service responded within the hour. Would buy again.',
          date: '2026-05-09',
          product: 'Aria Console Table',
          verifiedPurchase: true,
          helpfulCount: 9,
          topics: ['finish', 'packaging'],
        },
      ],
  }
});
