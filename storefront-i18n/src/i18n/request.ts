import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

const NAMESPACES = [
  'common',
  'navigation',
  'cart',
  'checkout',
  'payment',
  'validation',
  'reviews',
  'footer',
  'popup',
  'product',
  'home',
  'badges',
  'account',
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages: Record<string, unknown> = {};
  for (const ns of NAMESPACES) {
    messages[ns] = (await import(`../../messages/${locale}/${ns}.json`)).default;
  }

  return { locale, messages };
});
