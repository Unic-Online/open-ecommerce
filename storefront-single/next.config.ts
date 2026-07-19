import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Why: default `'strict'` emits one CSS chunk per import boundary,
    // which produced several small render-blocking files serialized after
    // HTML. `false` collapses them into one bundle per page — slightly larger
    // first-hit download for fewer round-trips.
    cssChunking: false,
  },
};

export default nextConfig;
