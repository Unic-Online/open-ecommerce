/**
 * Both RO and EN markets have `checkout.enabled = true`, so the "coming soon"
 * unavailable notice must never render on either storefront. This guards
 * against a regression where a market is accidentally toggled back to disabled
 * (e.g. via a botched merge of `market-config.ts`).
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    items: [
      {
        id: 'furniture__oslo-nightstand',
        productType: 'furniture',
        productName: 'Oslo Nightstand',
        slug: 'oslo-nightstand',
        shortName: 'Oslo Nightstand',
        quantity: 1,
        unitPrice: 749,
        image: '/test.png',
      },
    ],
    totalPrice: 749,
    totalItems: 1,
    clearCart: vi.fn(),
  }),
}));

vi.mock('@/components/RevolutPaymentWidgets', () => ({
  RevolutPaymentWidgets: () => <div data-testid="revolut-widgets" />,
}));

import CheckoutPage from '@/app/[locale]/checkout/page';

describe('CheckoutPage — market gating', () => {
  it('does not show the unavailable notice on the EN market', () => {
    renderWithProviders(<CheckoutPage />, { locale: 'en', market: 'english' });
    expect(screen.queryByText(/Orders not available for this area/i)).toBeNull();
  });

  it('does not show the unavailable notice on the RO market', () => {
    renderWithProviders(<CheckoutPage />, { locale: 'ro', market: 'ro' });
    expect(screen.queryByText(/Comenzi indisponibile/i)).toBeNull();
  });
});
