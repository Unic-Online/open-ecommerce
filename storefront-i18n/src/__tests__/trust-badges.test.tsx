/**
 * Regression gate for the unit-test i18n harness: TrustBadges resolves the
 * badges namespace at runtime, so the test harness must provide it too.
 *
 * Before test-utils carried badges, next-intl fell back to rendering the key
 * path (badges.retur14Zile) and emitted MISSING_MESSAGE on every checkout
 * render — any alt-text assertion would have silently checked the fallback
 * string instead of the real copy.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import TrustBadges from '@/components/TrustBadges';

describe('TrustBadges — badges i18n namespace', () => {
  it('renders the real RO badge alt copy, not the fallback key path', () => {
    renderWithProviders(<TrustBadges />, { locale: 'ro', market: 'ro' });
    expect(screen.getByAltText('14 zile retur')).toBeInTheDocument();
    expect(screen.queryByAltText('badges.retur14Zile')).not.toBeInTheDocument();
  });
});
