import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: {
    // Why: default `'strict'` emits one CSS chunk per import boundary,
    // which on the FR storefront produced 3 small render-blocking files
    // serialized after HTML. `false` collapses them into one bundle per
    // page — slightly larger first-hit download for fewer round-trips.
    // (Next 16.2 only exposes `boolean | 'strict'`; the `'loose'`
    // intermediate is a future-version option.)
    cssChunking: false,
  },
};

export default withNextIntl(nextConfig);
