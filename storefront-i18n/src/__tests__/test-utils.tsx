/**
 * Shared render helpers — wrap components in the providers they expect at
 * runtime: next-intl message context (RO by default) and the market context.
 *
 * Usage:
 *   import { renderWithProviders } from './test-utils'
 *   renderWithProviders(<CheckoutPage />)
 *
 * Override locale or market for EN-specific assertions:
 *   renderWithProviders(<X />, { locale: 'en', market: 'english' })
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { MarketProvider } from '@/i18n/market-context';
import { MARKETS, type MarketKey } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';
import roCommon from '../../messages/ro/common.json';
import roNavigation from '../../messages/ro/navigation.json';
import roCart from '../../messages/ro/cart.json';
import roCheckout from '../../messages/ro/checkout.json';
import roPayment from '../../messages/ro/payment.json';
import roValidation from '../../messages/ro/validation.json';
import roReviews from '../../messages/ro/reviews.json';
import roFooter from '../../messages/ro/footer.json';
import roPopup from '../../messages/ro/popup.json';
import roProduct from '../../messages/ro/product.json';
import roHome from '../../messages/ro/home.json';
import roBadges from '../../messages/ro/badges.json';
import roAccount from '../../messages/ro/account.json';
import enCommon from '../../messages/en/common.json';
import enNavigation from '../../messages/en/navigation.json';
import enCart from '../../messages/en/cart.json';
import enCheckout from '../../messages/en/checkout.json';
import enPayment from '../../messages/en/payment.json';
import enValidation from '../../messages/en/validation.json';
import enReviews from '../../messages/en/reviews.json';
import enFooter from '../../messages/en/footer.json';
import enPopup from '../../messages/en/popup.json';
import enProduct from '../../messages/en/product.json';
import enHome from '../../messages/en/home.json';
import enBadges from '../../messages/en/badges.json';
import enAccount from '../../messages/en/account.json';

const MESSAGES_BY_LOCALE = {
  ro: {
    common: roCommon,
    navigation: roNavigation,
    cart: roCart,
    checkout: roCheckout,
    payment: roPayment,
    validation: roValidation,
    reviews: roReviews,
    footer: roFooter,
    popup: roPopup,
    product: roProduct,
    home: roHome,
    badges: roBadges,
    account: roAccount,
  },
  en: {
    common: enCommon,
    navigation: enNavigation,
    cart: enCart,
    checkout: enCheckout,
    payment: enPayment,
    validation: enValidation,
    reviews: enReviews,
    footer: enFooter,
    popup: enPopup,
    product: enProduct,
    home: enHome,
    badges: enBadges,
    account: enAccount,
  },
} as const;

interface ProviderOptions {
  locale?: LocaleKey;
  market?: MarketKey;
}

export function TestProviders({
  children,
  locale = 'ro',
  market = 'ro',
}: { children: ReactNode } & ProviderOptions) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES_BY_LOCALE[locale]}>
      <MarketProvider value={MARKETS[market]}>{children}</MarketProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & ProviderOptions = {},
) {
  const { locale, market, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders locale={locale} market={market}>
        {children}
      </TestProviders>
    ),
    ...rest,
  });
}
