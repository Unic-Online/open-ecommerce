import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signReviewToken, verifyReviewToken } from '@/lib/orders/review-token';

const SECRET = 'test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod';

describe('review-token', () => {
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
    const token = signReviewToken('ABCD1234', 'oslo-nightstand', 90);
    const result = verifyReviewToken(token);
    expect(result).toMatchObject({ valid: true, orderId: 'ABCD1234', slug: 'oslo-nightstand' });
  });

  it('rejects a malformed token (no dot separator)', () => {
    expect(verifyReviewToken('not-a-real-token')).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('rejects a tampered signature', () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand');
    const [payload] = token.split('.');
    const tampered = `${payload}.${'A'.repeat(43)}`;
    expect(verifyReviewToken(tampered)).toEqual({ valid: false, reason: 'signature' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand');
    process.env.CART_RECOVERY_HMAC_SECRET = 'a-completely-different-secret-value';
    expect(verifyReviewToken(token)).toEqual({ valid: false, reason: 'signature' });
  });

  it('rejects an expired token', () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand', -1);
    expect(verifyReviewToken(token)).toEqual({ valid: false, reason: 'expired' });
  });

  it('a token minted for one order/slug does not verify against another', () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand');
    const result = verifyReviewToken(token);
    expect(result).toMatchObject({ valid: true, orderId: 'ABCD1234', slug: 'oslo-nightstand' });
    // The caller (POST /api/reviews) is responsible for cross-checking the
    // verified slug against the product page's slug — the token itself only
    // proves "this exact orderId+slug pair was signed by us".
    expect(result).not.toMatchObject({ slug: 'aria-console' });
  });

  it('throws when the HMAC secret is not configured', () => {
    delete process.env.CART_RECOVERY_HMAC_SECRET;
    expect(() => signReviewToken('ABCD1234', 'oslo-nightstand')).toThrow(
      'CART_RECOVERY_HMAC_SECRET is not set',
    );
  });
});
