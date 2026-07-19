/**
 * Shared render helpers — wrap components in the providers they expect at
 * runtime. Translations resolve through the `@/lib/strings` module directly
 * (no provider needed); only the market context requires a provider.
 *
 * Usage:
 *   import { renderWithProviders } from './test-utils'
 *   renderWithProviders(<CheckoutPage />)
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MarketProvider } from '@/lib/market-context';
import { MARKET } from '@/lib/market';

export function TestProviders({ children }: { children: ReactNode }) {
  return <MarketProvider value={MARKET}>{children}</MarketProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <TestProviders>{children}</TestProviders>,
    ...options,
  });
}
