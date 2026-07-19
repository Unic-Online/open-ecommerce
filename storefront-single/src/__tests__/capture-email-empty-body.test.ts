/**
 * Regression: POST /api/capture-email with an empty/truncated body must answer
 * 400 'Email invalid' — not 500 + a console stack. `navigator.sendBeacon`
 * bodies can arrive empty on page unload, so `await request.json()` throwing
 * `SyntaxError: Unexpected end of JSON input` is normal traffic, not an
 * internal error.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpsertContact } = vi.hoisted(() => ({
  mockUpsertContact: vi.fn(),
}));

vi.mock('@/lib/contacts', () => ({
  upsertContact: mockUpsertContact,
}));

import { POST } from '@/app/api/capture-email/route';

describe('POST /api/capture-email — defensive body parsing', () => {
  beforeEach(() => {
    mockUpsertContact.mockReset();
    mockUpsertContact.mockResolvedValue(undefined);
  });

  it('returns 400 (not 500) on an empty body', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(
      new Request('http://localhost/api/capture-email', { method: 'POST' }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Email invalid' });
    expect(mockUpsertContact).not.toHaveBeenCalled();
    // No stack noise for routine empty beacons.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns 400 on a truncated JSON body', async () => {
    const res = await POST(
      new Request('http://localhost/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email":"a@b.r',
      }),
    );

    expect(res.status).toBe(400);
    expect(mockUpsertContact).not.toHaveBeenCalled();
  });

  it('still captures a valid payload', async () => {
    const res = await POST(
      new Request('http://localhost/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ana@test.ro', source: 'email_popup' }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockUpsertContact).toHaveBeenCalledWith('ana@test.ro', expect.objectContaining({
      source: 'email_popup',
    }));
  });
});
