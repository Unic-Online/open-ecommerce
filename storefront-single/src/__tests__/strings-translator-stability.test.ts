/**
 * `useTranslations` must return a STABLE translator reference per namespace.
 *
 * Regression guard: the shim previously built a fresh `t` on every call, which
 * destabilized any useCallback/useEffect listing `t` in its deps. In
 * RevolutPaymentWidgets that made the wallet effect re-run on every render and
 * re-mount the Apple Pay button endlessly (infinite flicker). A per-namespace
 * cache gives `t` a stable identity. This test fails if that cache is removed.
 */
import { describe, it, expect } from 'vitest';
import { useTranslations } from '@/lib/strings';

describe('useTranslations translator identity', () => {
  it('returns the same instance for the same namespace across calls', () => {
    expect(useTranslations('payment')).toBe(useTranslations('payment'));
  });

  it('returns distinct instances for different namespaces', () => {
    expect(useTranslations('payment')).not.toBe(useTranslations('cart'));
  });

  it('still exposes the full translator API', () => {
    const t = useTranslations('payment');
    expect(typeof t).toBe('function');
    expect(typeof t.rich).toBe('function');
    expect(typeof t.raw).toBe('function');
    expect(typeof t.has).toBe('function');
  });
});
