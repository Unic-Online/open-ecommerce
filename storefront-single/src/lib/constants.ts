// Thin re-export. Cross-market brand + legal constants now live in
// `src/site.config.ts` (the single source of truth for all site config).
// This module stays so existing `@/lib/constants` imports don't change.
//
// `TRADEMARK` is conceptually OPTIONAL — it may be `undefined` for a rebrand
// without a registered trademark. Consumers (TrademarkNotice, landing page,
// contact page) must guard against `undefined` and render nothing when absent.
//
// Per-market values (email, WhatsApp, brand display name, base URL, merchant
// notification recipients) live in `src/i18n/market-config.ts` and are accessed
// via `getMarketConfig(market)` or the React `useMarket()` hook on the client.
export { trademark as TRADEMARK, SPRING_SALE_END_ISO } from '@/site.config';
export type { TrademarkConfig } from '@/site.config';
