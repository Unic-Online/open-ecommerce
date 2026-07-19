import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signReviewToken } from '@/lib/orders/review-token';

const { mockGetOrder, mockCountRecentReviewsByIp, mockInsertPendingReview } = vi.hoisted(() => ({
  mockGetOrder: vi.fn(),
  mockCountRecentReviewsByIp: vi.fn(),
  mockInsertPendingReview: vi.fn(),
}));

vi.mock('@/lib/orders/queries', () => ({ getOrder: mockGetOrder }));
vi.mock('@/lib/reviews-store', () => ({
  countRecentReviewsByIp: mockCountRecentReviewsByIp,
  insertPendingReview: mockInsertPendingReview,
}));

import { POST } from '@/app/api/reviews/route';

// `oslo-nightstand` is a real, live product in content/products — used here
// on purpose instead of mocking the catalog, which would risk drifting from
// the real registry shape.
const validBody = {
  slug: 'oslo-nightstand',
  name: 'Ion Popescu',
  rating: 5,
  text: 'Produs excelent, recomand cu incredere tuturor.',
  locale: 'ro',
};

const SECRET = 'test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod';
let originalSecret: string | undefined;

function call(body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Response> {
  const request = new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  originalSecret = process.env.CART_RECOVERY_HMAC_SECRET;
  process.env.CART_RECOVERY_HMAC_SECRET = SECRET;
  mockCountRecentReviewsByIp.mockResolvedValue(0);
  mockInsertPendingReview.mockResolvedValue({
    ok: true,
    review: { verifiedPurchase: false },
  });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CART_RECOVERY_HMAC_SECRET;
  else process.env.CART_RECOVERY_HMAC_SECRET = originalSecret;
});

describe('POST /api/reviews', () => {
  it('rejects unparsable JSON', async () => {
    const request = new Request('http://localhost/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it('rejects a body that fails schema validation (name too short)', async () => {
    const res = await call({ ...validBody, name: 'A' });
    expect(res.status).toBe(400);
    expect(mockInsertPendingReview).not.toHaveBeenCalled();
  });

  it('rejects a comment under 10 characters', async () => {
    const res = await call({ ...validBody, text: 'too short' });
    expect(res.status).toBe(400);
  });

  it('silently no-ops (200, no persistence) when the honeypot field is filled', async () => {
    const res = await call({ ...validBody, company: 'Acme Corp' });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockInsertPendingReview).not.toHaveBeenCalled();
  });

  it('rejects an unknown product slug', async () => {
    const res = await call({ ...validBody, slug: 'this-product-does-not-exist' });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('unknown-product');
    expect(mockInsertPendingReview).not.toHaveBeenCalled();
  });

  it('rate-limits after 5 recent reviews from the same IP', async () => {
    mockCountRecentReviewsByIp.mockResolvedValueOnce(5);
    const res = await call(validBody, { 'x-forwarded-for': '203.0.113.5' });
    expect(res.status).toBe(429);
    expect(mockInsertPendingReview).not.toHaveBeenCalled();
  });

  it('does not rate-limit when the client IP cannot be determined', async () => {
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect(mockCountRecentReviewsByIp).not.toHaveBeenCalled();
  });

  it('inserts as unverified when no rt token is present', async () => {
    await call(validBody);
    expect(mockInsertPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'oslo-nightstand', verifiedPurchase: false, orderId: undefined }),
    );
  });

  it('upgrades to verifiedPurchase when the token matches a real order containing the slug', async () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand');
    mockGetOrder.mockResolvedValueOnce({ orderId: 'ABCD1234', items: [{ slug: 'oslo-nightstand' }] });
    await call({ ...validBody, rt: token });
    expect(mockGetOrder).toHaveBeenCalledWith('ABCD1234');
    expect(mockInsertPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedPurchase: true, orderId: 'ABCD1234' }),
    );
  });

  it('degrades to unverified when the token names a different slug than the one submitted', async () => {
    const token = signReviewToken('ABCD1234', 'aria-console');
    await call({ ...validBody, slug: 'oslo-nightstand', rt: token });
    expect(mockGetOrder).not.toHaveBeenCalled();
    expect(mockInsertPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedPurchase: false, orderId: undefined }),
    );
  });

  it('degrades to unverified when the order does not actually contain the reviewed product', async () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand');
    mockGetOrder.mockResolvedValueOnce({ orderId: 'ABCD1234', items: [{ slug: 'aria-console' }] });
    await call({ ...validBody, rt: token });
    expect(mockInsertPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedPurchase: false, orderId: undefined }),
    );
  });

  it('degrades to unverified when the order is not found', async () => {
    const token = signReviewToken('ABCD1234', 'oslo-nightstand');
    mockGetOrder.mockResolvedValueOnce(null);
    await call({ ...validBody, rt: token });
    expect(mockInsertPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedPurchase: false }),
    );
  });

  it('degrades to unverified (never rejects the submission) on a malformed rt token', async () => {
    const res = await call({ ...validBody, rt: 'garbage-not-a-token' });
    expect(res.status).toBe(200);
    expect(mockGetOrder).not.toHaveBeenCalled();
    expect(mockInsertPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedPurchase: false }),
    );
  });

  it('returns 409 on a duplicate verified review for the same order+product', async () => {
    mockInsertPendingReview.mockResolvedValueOnce({ ok: false, reason: 'duplicate' });
    const res = await call(validBody);
    expect(res.status).toBe(409);
  });

  it('returns 503 (truthful negative) when the store is in dry-run', async () => {
    mockInsertPendingReview.mockResolvedValueOnce({ ok: false, reason: 'dry-run' });
    const res = await call(validBody);
    expect(res.status).toBe(503);
  });
});
