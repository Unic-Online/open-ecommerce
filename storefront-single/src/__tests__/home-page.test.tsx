/**
 * Verify the homepage renders correct English copy.
 * Guards against regressions where strings are broken or missing.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';

vi.mock('@/components/HeroCarousel', () => ({
  default: () => null,
}));

vi.mock('@/components/Countdown', () => ({
  default: () => null,
}));

import HomePage from '@/app/page';

describe('HomePage — body copy', () => {
  it('renders EN section titles across the homepage body', async () => {
    const ui = await HomePage();
    renderWithProviders(ui);

    // Section title for furniture
    expect(screen.getByText(/Furniture for every room/i)).toBeInTheDocument();
    // Trust item title
    expect(screen.getByText(/100% secure payment/i)).toBeInTheDocument();
    // Trade CTA copy
    expect(screen.getByText(/Request a custom quote/i)).toBeInTheDocument();
    // Category tile
    expect(screen.getAllByText(/Furniture/i).length).toBeGreaterThan(0);
  });

  it('renders the trade CTA as a mailto link', async () => {
    const ui = await HomePage();
    renderWithProviders(ui);

    const cta = screen.getByText(/Request a custom quote/i).closest('a');
    expect(cta).not.toBeNull();
    expect(cta?.getAttribute('href')).toMatch(/^mailto:contact@example\.com/);
  });

  it('never shows RON currency in the EN storefront', async () => {
    const ui = await HomePage();
    const { container } = renderWithProviders(ui);

    expect(container.textContent).not.toMatch(/\blei\b/i);
    expect(container.textContent).not.toMatch(/\bRON\b/);
  });
});
