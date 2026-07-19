import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRequireAdmin, mockDecideReview } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockDecideReview: vi.fn(),
}));

vi.mock('@/plugins/abandoned-cart/server/admin-auth', () => ({
  requireAdmin: mockRequireAdmin,
}));
vi.mock('@/lib/reviews-store', () => ({
  decideReview: mockDecideReview,
}));

import { POST } from '@/app/api/admin/reviews/[reviewId]/decision/route';

function call(reviewId: string, body: unknown): Promise<Response> {
  const request = new Request(`http://localhost/api/admin/reviews/${reviewId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ reviewId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(true);
});

describe('POST /api/admin/reviews/[reviewId]/decision', () => {
  it('requires admin auth', async () => {
    mockRequireAdmin.mockResolvedValueOnce(false);
    const res = await call('X', { action: 'approve' });
    expect(res.status).toBe(401);
    expect(mockDecideReview).not.toHaveBeenCalled();
  });

  it('rejects a malformed action', async () => {
    const res = await call('X', { action: 'yolo' });
    expect(res.status).toBe(400);
    expect(mockDecideReview).not.toHaveBeenCalled();
  });

  it('rejects unparsable JSON', async () => {
    const request = new Request('http://localhost/api/admin/reviews/X/decision', {
      method: 'POST',
      body: '{bad',
    });
    const res = await POST(request, { params: Promise.resolve({ reviewId: 'X' }) });
    expect(res.status).toBe(400);
  });

  it('approve maps to the "approved" status', async () => {
    mockDecideReview.mockResolvedValueOnce({ ok: true, review: { status: 'approved' } });
    const res = await call('X', { action: 'approve' });
    expect(res.status).toBe(200);
    expect(mockDecideReview).toHaveBeenCalledWith('X', 'approved');
    expect((await res.json())).toEqual({ ok: true, status: 'approved' });
  });

  it('decline maps to the "declined" status', async () => {
    mockDecideReview.mockResolvedValueOnce({ ok: true, review: { status: 'declined' } });
    const res = await call('X', { action: 'decline' });
    expect(mockDecideReview).toHaveBeenCalledWith('X', 'declined');
    expect((await res.json())).toEqual({ ok: true, status: 'declined' });
  });

  it('maps already-decided to 409', async () => {
    mockDecideReview.mockResolvedValueOnce({ ok: false, reason: 'already-decided' });
    const res = await call('X', { action: 'approve' });
    expect(res.status).toBe(409);
  });

  it('maps not-found to 404', async () => {
    mockDecideReview.mockResolvedValueOnce({ ok: false, reason: 'not-found' });
    const res = await call('X', { action: 'approve' });
    expect(res.status).toBe(404);
  });

  it('maps dry-run to 503', async () => {
    mockDecideReview.mockResolvedValueOnce({ ok: false, reason: 'dry-run' });
    const res = await call('X', { action: 'approve' });
    expect(res.status).toBe(503);
  });
});
