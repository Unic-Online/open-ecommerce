/**
 * POST /api/capture-email — validation and contact-upsert contracts. The
 * defensive empty/truncated-body behavior is pinned separately in
 * `capture-email-empty-body.test.ts`; this file covers the rest of the surface.
 */
import { describe, it, expect, vi } from 'vitest';

const { mockUpsertContact } = vi.hoisted(() => ({
  mockUpsertContact: vi.fn(async () => undefined),
}));

vi.mock('@/lib/contacts', () => ({
  upsertContact: mockUpsertContact,
}));

import { POST } from '@/app/api/capture-email/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/capture-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/capture-email', () => {
  it('400 on an invalid email; no contact write', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Email invalid' });
    expect(mockUpsertContact).not.toHaveBeenCalled();
  });

  it('defaults source to email_popup when omitted', async () => {
    const res = await POST(makeRequest({ email: 'ion@test.ro' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockUpsertContact).toHaveBeenCalledWith('ion@test.ro', {
      source: 'email_popup',
    });
  });

  it('forwards source / firstName / lastName when provided', async () => {
    const res = await POST(
      makeRequest({
        email: 'ion@test.ro',
        source: 'exit_intent',
        firstName: 'Ion',
        lastName: 'Popescu',
      }),
    );
    expect(res.status).toBe(200);
    expect(mockUpsertContact).toHaveBeenCalledWith('ion@test.ro', {
      source: 'exit_intent',
      firstName: 'Ion',
      lastName: 'Popescu',
    });
  });

  it('500 Internal error when the contact upsert throws (DB down)', async () => {
    mockUpsertContact.mockRejectedValueOnce(new Error('mongo down'));
    const res = await POST(makeRequest({ email: 'ion@test.ro' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal error' });
  });

  it('rejects over-length name fields (max 100)', async () => {
    const res = await POST(
      makeRequest({ email: 'ion@test.ro', firstName: 'x'.repeat(101) }),
    );
    expect(res.status).toBe(400);
    expect(mockUpsertContact).not.toHaveBeenCalled();
  });
});
