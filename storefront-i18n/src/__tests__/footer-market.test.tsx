/**
 * Acceptance gate for the market-aware Footer:
 *   - The WhatsApp anchor renders only when the market sets a whatsappNumber.
 *     The demo brand ships both markets with an empty number, so the anchor is
 *     hidden everywhere — the conditional-render behavior is what's asserted.
 *   - The displayed business email matches the market's contact mailbox.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { MARKETS } from '@/i18n/market-config';
import Footer from '@/components/Footer';

function telLinks(): HTMLElement[] {
  return screen
    .queryAllByRole('link')
    .filter((a) => a.getAttribute('href')?.startsWith('tel:'));
}

describe('Footer — market-aware contact block', () => {
  it('hides the WhatsApp anchor on the RO market when whatsappNumber is empty', () => {
    // Guard: the demo config sets RO whatsappNumber to ''. If an operator
    // restores a real number this assertion documents the hide-on-empty rule.
    expect(MARKETS.ro.contact.whatsappNumber).toBe('');
    renderWithProviders(<Footer />, { locale: 'ro', market: 'ro' });
    expect(telLinks()).toEqual([]);
  });

  it('hides the WhatsApp anchor on the english market (whatsappNumber === "")', () => {
    renderWithProviders(<Footer />, { locale: 'en', market: 'english' });
    // The market's whatsappDisplay is empty on english, so no anchor should be
    // rendered. Searching for any tel: link should yield nothing.
    expect(telLinks()).toEqual([]);
  });

  it('uses the market businessEmail in the contact block', () => {
    renderWithProviders(<Footer />, { locale: 'en', market: 'english' });
    const mailLink = screen.getByRole('link', {
      name: MARKETS.english.contact.businessEmail,
    });
    expect(mailLink.getAttribute('href')).toBe(
      `mailto:${MARKETS.english.contact.businessEmail}`,
    );
  });
});
