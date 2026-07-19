import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  signRecoveryToken,
  verifyRecoveryToken,
} from '@/plugins/abandoned-cart/server/recovery-token';

const SECRET = 'test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod';

describe('recovery-token', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.CART_RECOVERY_HMAC_SECRET;
    process.env.CART_RECOVERY_HMAC_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CART_RECOVERY_HMAC_SECRET;
    else process.env.CART_RECOVERY_HMAC_SECRET = originalSecret;
  });

  it('roundtrips a valid token', () => {
    const token = signRecoveryToken('cart-abc-123', 7);
    const result = verifyRecoveryToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.cartId).toBe('cart-abc-123');
      expect(result.exp).toBeGreaterThan(Date.now());
    }
  });

  it('rejects tampered payload', () => {
    const token = signRecoveryToken('cart-abc-123', 7);
    const [, sig] = token.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ cartId: 'cart-evil', exp: Date.now() + 999999 })).toString('base64url')}.${sig}`;
    const result = verifyRecoveryToken(tampered);
    expect(result.valid).toBe(false);
  });

  it('rejects tampered signature', () => {
    const token = signRecoveryToken('cart-abc-123', 7);
    const [payload] = token.split('.');
    const result = verifyRecoveryToken(`${payload}.notarealsignature`);
    expect(result.valid).toBe(false);
  });

  it('rejects malformed token', () => {
    expect(verifyRecoveryToken('garbage').valid).toBe(false);
    expect(verifyRecoveryToken('a.b.c').valid).toBe(false);
    expect(verifyRecoveryToken('').valid).toBe(false);
  });

  it('rejects expired token', () => {
    const token = signRecoveryToken('cart-abc-123', -1); // already expired
    const result = verifyRecoveryToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('expired');
    }
  });

  it('rejects when secret changed', () => {
    const token = signRecoveryToken('cart-abc-123', 7);
    process.env.CART_RECOVERY_HMAC_SECRET = 'a-different-secret';
    const result = verifyRecoveryToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('signature');
    }
  });
});
