import { defineProduct } from '@/lib/product-schema';

export const product = defineProduct({
  slug: 'terra-path-light',
  category: 'outdoor',
  business: {
    inStock: true,
    reviewsKey: 'terra-path-light',
    popularSlugs: ['oslo-nightstand', 'halo-table-lamp'],
    price: 69, oldPrice: 89, currency: 'EUR'
  },
  content: {
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
  }
});
