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
    price: 149, oldPrice: 199, currency: 'EUR'
  },
  content: {
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
  }
});
