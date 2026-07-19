import { headers } from 'next/headers';
import RecoverClient from './RecoverClient';
import { getCurrentMarket } from '@/i18n/market-resolver';
import { getMarketConfig, getHostMarketMap } from '@/i18n/market-config';
import { defaultLocale } from '@/i18n/locales';

// Recovery URL handler. Client-rendered because cookies().set() and
// localStorage writes both need to happen on the user's device — the
// server component cannot persist either. The actual verification +
// cart lookup + cookie setting lives in /api/cart/recover/[token],
// which this client wrapper calls on mount.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

// Mirror of `routing.ts` `'/comanda'` pathnames map. Kept inline (instead
// of going through next-intl's `getPathname`) because /recover lives
// outside the [locale] segment, where calling next-intl navigation helpers
// from a server component crashed under the `domains` routing config.
// recover-page-routing.test.tsx pins these values so any drift in
// routing.ts trips the test.
const CART_PATH_BY_LOCALE = {
  ro: '/comanda',
  en: '/cart',
} as const;

// Per-locale loading text. /recover is outside next-intl, so we can't
// useTranslations() here and the messages catalog isn't loaded — keep the
// strings inline for the same reason cartPath is inlined.
const LOADING_TEXT_BY_LOCALE = {
  ro: 'Restaurăm coșul tău…',
  en: 'Restoring your basket…',
} as const;

export default async function RecoverPage({ params }: PageProps) {
  const { token } = await params;
  // Why: /recover is not under [locale] (no locale prefix in the URL), so
  // the client can't read the active locale or market via the providers
  // (none mount above this segment). Resolve both from the request host
  // here. Market drives client-side price-refresh on recovered items;
  // cartPath drives the post-recovery redirect.
  const market = await getCurrentMarket();
  const locale = getMarketConfig(market).locale;
  const basePath = CART_PATH_BY_LOCALE[locale];
  // Why the prefix dance: on configured market domains next-intl serves the
  // market's locale UNPREFIXED (domain routing), so the bare localized path
  // is correct. On fallback hosts (localhost, Vercel previews) routing is
  // localePrefix 'as-needed' under defaultLocale — there a non-default
  // locale path MUST carry its /<locale> prefix, or the proxy normalizes
  // the redirect to the default locale's route and the market-price guard
  // on the cart page silently drops the just-recovered items.
  const host = (await headers()).get('host')?.toLowerCase().split(':')[0] ?? '';
  const isMarketDomain = Boolean(getHostMarketMap()[host]);
  const cartPath =
    isMarketDomain || locale === defaultLocale ? basePath : `/${locale}${basePath}`;
  const loadingText = LOADING_TEXT_BY_LOCALE[locale];
  return (
    <RecoverClient
      token={token}
      cartPath={cartPath}
      market={market}
      loadingText={loadingText}
    />
  );
}
