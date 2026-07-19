/**
 * Account auth — magic-link tokens + signed session cookies.
 *
 * Pure-logic tests: HMAC roundtrip, expiry, tamper rejection, secret-rotation
 * invalidation. Mongo-backed pieces (nonce store, rate limit) are exercised
 * by the request-link / verify endpoint tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ACCOUNT_COOKIE_NAME,
  createAccountSessionToken,
  createMagicLinkToken,
  isAccountAuthConfigured,
  verifyAccountSessionToken,
  verifyMagicLinkToken,
} from '@/lib/account-auth';
import { createSessionToken } from '@/plugins/abandoned-cart/server/admin-auth';
import { signRecoveryToken } from '@/plugins/abandoned-cart/server/recovery-token';

const SECRET =
  'account-test-hmac-secret-not-real-not-real-not-real-not-real-not-real';

describe('account-auth', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.CART_RECOVERY_HMAC_SECRET;
    process.env.CART_RECOVERY_HMAC_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.CART_RECOVERY_HMAC_SECRET = originalSecret;
  });

  it('cookie name is namespaced for the account session, not admin', () => {
    expect(ACCOUNT_COOKIE_NAME).toBe('sf_account_session');
  });

  describe('isAccountAuthConfigured', () => {
    it('returns true when HMAC secret is set', () => {
      expect(isAccountAuthConfigured()).toBe(true);
    });

    it('returns false without the HMAC secret', () => {
      delete process.env.CART_RECOVERY_HMAC_SECRET;
      expect(isAccountAuthConfigured()).toBe(false);
    });
  });

  describe('magic-link token', () => {
    it('roundtrips email + locale + nonce', () => {
      const token = createMagicLinkToken('ion@test.ro', 'ro', 'nonce-abc-123');
      const decoded = verifyMagicLinkToken(token);
      expect(decoded).toEqual({
        email: 'ion@test.ro',
        locale: 'ro',
        nonce: 'nonce-abc-123',
      });
    });

    it('lowercases the email at issue time', () => {
      const token = createMagicLinkToken('Ion@Test.RO', 'ro', 'n1');
      const decoded = verifyMagicLinkToken(token);
      expect(decoded?.email).toBe('ion@test.ro');
    });

    it('preserves the issued locale (en)', () => {
      const token = createMagicLinkToken('john@test.com', 'en', 'n2');
      const decoded = verifyMagicLinkToken(token);
      expect(decoded?.locale).toBe('en');
    });

    it('rejects malformed tokens', () => {
      expect(verifyMagicLinkToken('garbage')).toBeNull();
      expect(verifyMagicLinkToken('a.b.c')).toBeNull();
      expect(verifyMagicLinkToken('')).toBeNull();
    });

    it('rejects a tampered signature', () => {
      const token = createMagicLinkToken('ion@test.ro', 'ro', 'n3');
      const [payload] = token.split('.');
      expect(verifyMagicLinkToken(`${payload}.notarealsignature`)).toBeNull();
    });

    it('rejects when the secret has rotated', () => {
      const token = createMagicLinkToken('ion@test.ro', 'ro', 'n4');
      process.env.CART_RECOVERY_HMAC_SECRET = 'different-secret';
      expect(verifyMagicLinkToken(token)).toBeNull();
    });

    it('rejects an expired token', () => {
      const realNow = Date.now;
      try {
        // Issue at T0
        Date.now = () => 1_000_000_000_000;
        const token = createMagicLinkToken('ion@test.ro', 'ro', 'n5');
        // Verify 16 minutes later (TTL is 15 min)
        Date.now = () => 1_000_000_000_000 + 16 * 60 * 1000;
        expect(verifyMagicLinkToken(token)).toBeNull();
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('account session token', () => {
    it('roundtrips email', () => {
      const token = createAccountSessionToken('ion@test.ro');
      expect(verifyAccountSessionToken(token)).toEqual({ email: 'ion@test.ro' });
    });

    it('lowercases email at issue time', () => {
      const token = createAccountSessionToken('Ion@Test.RO');
      expect(verifyAccountSessionToken(token)?.email).toBe('ion@test.ro');
    });

    it('rejects malformed tokens', () => {
      expect(verifyAccountSessionToken('garbage')).toBeNull();
      expect(verifyAccountSessionToken('')).toBeNull();
    });

    it('rejects a tampered signature', () => {
      const token = createAccountSessionToken('ion@test.ro');
      const [payload] = token.split('.');
      expect(verifyAccountSessionToken(`${payload}.fakesig`)).toBeNull();
    });

    it('rejects when the secret has rotated', () => {
      const token = createAccountSessionToken('ion@test.ro');
      process.env.CART_RECOVERY_HMAC_SECRET = 'different-secret';
      expect(verifyAccountSessionToken(token)).toBeNull();
    });
  });

  // All four token classes (admin session, customer session, magic link,
  // cart recovery) share `CART_RECOVERY_HMAC_SECRET`. Each verifier MUST
  // reject tokens issued by a sibling class — otherwise a magic-link token
  // in a customer's inbox can be planted as an admin or session cookie.
  describe('cross-kind isolation', () => {
    it('magic-link token is rejected by the session verifier', () => {
      const magic = createMagicLinkToken('ion@test.ro', 'ro', 'nonce-x');
      expect(verifyAccountSessionToken(magic)).toBeNull();
    });

    it('session token is rejected by the magic-link verifier', () => {
      const session = createAccountSessionToken('ion@test.ro');
      expect(verifyMagicLinkToken(session)).toBeNull();
    });

    it('admin session token is rejected by both account verifiers', () => {
      const admin = createSessionToken();
      expect(verifyAccountSessionToken(admin)).toBeNull();
      expect(verifyMagicLinkToken(admin)).toBeNull();
    });

    it('cart-recovery token is rejected by both account verifiers', () => {
      const recovery = signRecoveryToken('cart-abc', 7);
      expect(verifyAccountSessionToken(recovery)).toBeNull();
      expect(verifyMagicLinkToken(recovery)).toBeNull();
    });
  });
});
