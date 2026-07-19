// Thin re-export. The canonical locale list + default live in
// `src/site.config.ts` (the single source of truth for all site config).
// This module stays so the ~many `@/i18n/locales` imports don't change.
export { locales, defaultLocale } from '@/site.config';
export type { LocaleKey } from '@/site.config';
