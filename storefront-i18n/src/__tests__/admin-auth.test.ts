import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionToken,
  isAdminConfigured,
  passwordMatches,
  verifySessionToken,
} from '@/plugins/abandoned-cart/server/admin-auth';
import {
  createAccountSessionToken,
  createMagicLinkToken,
} from '@/lib/account-auth';
import { signRecoveryToken } from '@/plugins/abandoned-cart/server/recovery-token';

const SECRET =
  'admin-test-hmac-secret-not-real-not-real-not-real-not-real-not-real';
const PASSWORD = 'hunter2-test-only';

describe('admin-auth', () => {
  let originalSecret: string | undefined;
  let originalPassword: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.CART_RECOVERY_HMAC_SECRET;
    originalPassword = process.env.ADMIN_PASSWORD;
    process.env.CART_RECOVERY_HMAC_SECRET = SECRET;
    process.env.ADMIN_PASSWORD = PASSWORD;
  });

  afterEach(() => {
    process.env.CART_RECOVERY_HMAC_SECRET = originalSecret;
    process.env.ADMIN_PASSWORD = originalPassword;
  });

  describe('isAdminConfigured', () => {
    it('returns true when both vars are set', () => {
      expect(isAdminConfigured()).toBe(true);
    });

    it('returns false without ADMIN_PASSWORD', () => {
      delete process.env.ADMIN_PASSWORD;
      expect(isAdminConfigured()).toBe(false);
    });

    it('returns false without HMAC secret', () => {
      delete process.env.CART_RECOVERY_HMAC_SECRET;
      expect(isAdminConfigured()).toBe(false);
    });
  });

  describe('passwordMatches', () => {
    it('matches the configured password exactly', () => {
      expect(passwordMatches(PASSWORD)).toBe(true);
    });

    it('rejects a wrong password', () => {
      expect(passwordMatches('wrong')).toBe(false);
    });

    it('rejects an empty input', () => {
      expect(passwordMatches('')).toBe(false);
    });

    it('rejects when ADMIN_PASSWORD is unset', () => {
      delete process.env.ADMIN_PASSWORD;
      expect(passwordMatches(PASSWORD)).toBe(false);
    });
  });

  describe('session token', () => {
    it('roundtrips a valid token', () => {
      const token = createSessionToken();
      expect(verifySessionToken(token)).toBe(true);
    });

    it('rejects malformed tokens', () => {
      expect(verifySessionToken('garbage')).toBe(false);
      expect(verifySessionToken('a.b.c')).toBe(false);
      expect(verifySessionToken('')).toBe(false);
    });

    it('rejects a tampered signature', () => {
      const token = createSessionToken();
      const [payload] = token.split('.');
      expect(verifySessionToken(`${payload}.notarealsignature`)).toBe(false);
    });

    it('rejects when the secret has changed', () => {
      const token = createSessionToken();
      process.env.CART_RECOVERY_HMAC_SECRET = 'different-secret';
      expect(verifySessionToken(token)).toBe(false);
    });
  });

  // Tokens from sibling token classes (magic link, customer session, cart
  // recovery) share the same HMAC secret. Without context-binding, an
  // attacker could plant any well-signed token with a future `exp` as an
  // admin cookie. The verifier MUST reject all of them.
  describe('cross-kind isolation', () => {
    it('rejects an account session token', () => {
      expect(verifySessionToken(createAccountSessionToken('ion@test.ro'))).toBe(false);
    });

    it('rejects a magic-link token', () => {
      expect(verifySessionToken(createMagicLinkToken('ion@test.ro', 'ro', 'n1'))).toBe(false);
    });

    it('rejects a cart-recovery token', () => {
      expect(verifySessionToken(signRecoveryToken('cart-abc', 7))).toBe(false);
    });
  });
});
