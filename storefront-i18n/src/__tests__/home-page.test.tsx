/**
 * Verify the homepage renders correct copy for each market (EN + RO).
 * Guards against regressions where strings leak across markets.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { renderWithProviders } from './test-utils';
import enHome from '../../messages/en/home.json';
import enCommon from '../../messages/en/common.json';
import roHome from '../../messages/ro/home.json';
import roCommon from '../../messages/ro/common.json';

// Force EN market for the first describe block.
vi.mock('@/i18n/market-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/market-resolver')>();
  return {
    ...actual,
    getCurrentMarket: vi.fn(async () => 'english'),
  };
});

vi.mock('next-intl/server', async () => {
  return {
    getTranslations: vi.fn(async ({ namespace, locale }: { namespace: string; locale?: string }) => {
      const isRo = locale === 'ro';
      const messages: Record<string, unknown> = isRo
        ? { home: roHome, common: roCommon }
        : { home: enHome, common: enCommon };
      const loc = isRo ? 'ro' : 'en';
      return createTranslator({ locale: loc, namespace, messages });
    }),
  };
});

vi.mock('@/components/HeroCarousel', () => ({
  default: () => null,
}));

vi.mock('@/components/Countdown', () => ({
  default: () => null,
}));

import HomePage from '@/app/[locale]/page';

describe('HomePage — EN market (english) body copy', () => {
  it('renders EN section titles across the homepage body', async () => {
    const ui = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
    renderWithProviders(ui, { locale: 'en', market: 'english' });

    // Section title for furniture
    expect(screen.getByText(/Furniture for every room/i)).toBeInTheDocument();
    // Trust item title
    expect(screen.getByText(/100% secure payment/i)).toBeInTheDocument();
    // Trade CTA copy
    expect(screen.getByText(/Request a custom quote/i)).toBeInTheDocument();
    // Category tile
    expect(screen.getAllByText(/Furniture/i).length).toBeGreaterThan(0);
  });

  it('renders the trade CTA as a mailto link when the EN market has no WhatsApp', async () => {
    const ui = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
    renderWithProviders(ui, { locale: 'en', market: 'english' });

    const cta = screen.getByText(/Request a custom quote/i).closest('a');
    expect(cta).not.toBeNull();
    // EN market has no WhatsApp → falls back to mailto
    expect(cta?.getAttribute('href')).toMatch(/^mailto:contact@example\.com/);
  });

  it('never leaks RON / Romanian copy into the EN storefront', async () => {
    const ui = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
    const { container } = renderWithProviders(ui, { locale: 'en', market: 'english' });

    expect(container.textContent).not.toMatch(/\blei\b/i);
    expect(container.textContent).not.toMatch(/Mobilier pentru orice cameră/);
  });
});

describe('HomePage — RO market body copy', () => {
  it('renders RO section titles', async () => {
    vi.mocked(
      (await import('@/i18n/market-resolver')).getCurrentMarket,
    ).mockResolvedValue('ro');

    const ui = await HomePage({ params: Promise.resolve({ locale: 'ro' }) });
    renderWithProviders(ui, { locale: 'ro', market: 'ro' });

    expect(screen.getByText(/Mobilier pentru orice cameră/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mobilier/i).length).toBeGreaterThan(0);
  });
});
