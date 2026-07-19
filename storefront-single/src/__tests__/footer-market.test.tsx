/**
 * Acceptance gate for the market-aware Footer:
 *   - The WhatsApp anchor renders only when the market sets a whatsappNumber.
 *     The demo brand ships with an empty number, so the anchor is
 *     hidden — the conditional-render behavior is what's asserted.
 *   - The displayed business email matches the market's contact mailbox.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { MARKET } from '@/lib/market';
import Footer from '@/components/Footer';

function telLinks(): HTMLElement[] {
  return screen
    .queryAllByRole('link')
    .filter((a) => a.getAttribute('href')?.startsWith('tel:'));
}

describe('Footer — market-aware contact block', () => {
  it('hides the WhatsApp anchor when whatsappNumber is empty', () => {
    // Guard: the demo config sets whatsappNumber to ''. If an operator
    // restores a real number this assertion documents the hide-on-empty rule.
    expect(MARKET.contact.whatsappNumber).toBe('');
    renderWithProviders(<Footer />);
    expect(telLinks()).toEqual([]);
  });

  it('uses the market businessEmail in the contact block', () => {
    renderWithProviders(<Footer />);
    const mailLink = screen.getByRole('link', {
      name: MARKET.contact.businessEmail,
    });
    expect(mailLink.getAttribute('href')).toBe(
      `mailto:${MARKET.contact.businessEmail}`,
    );
  });
});
