/**
 * The single market has `checkout.enabled = true`, so the "coming soon"
 * unavailable notice must never render. This guards against a regression
 * where the market is accidentally toggled back to disabled.
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
        unitPrice: 149,
        image: '/test.png',
      },
    ],
    totalPrice: 149,
    totalItems: 1,
    clearCart: vi.fn(),
  }),
}));

vi.mock('@/components/RevolutPaymentWidgets', () => ({
  RevolutPaymentWidgets: () => <div data-testid="revolut-widgets" />,
}));

import CheckoutPage from '@/app/checkout/page';

describe('CheckoutPage — market gating', () => {
  it('does not show the unavailable notice on the main market', () => {
    renderWithProviders(<CheckoutPage />);
    expect(screen.queryByText(/Orders not available for this area/i)).toBeNull();
  });
});
