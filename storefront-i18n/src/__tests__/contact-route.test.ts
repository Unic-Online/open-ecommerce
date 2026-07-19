/**
 * POST /api/contact (issue #19) — Resend send + Mongo contact write.
 * Contracts: schema (incl. RO phone), business email routing with the
 * customer as replyTo, send-failure → 500, and the fire-and-forget contact
 * upsert that must never fail the response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resendLibModule, sendEmailMock } from './helpers/resend.mock';

const { mockUpsertContact } = vi.hoisted(() => ({
  mockUpsertContact: vi.fn(async () => undefined),
}));

vi.mock('@/lib/resend', () => resendLibModule());
vi.mock('@/lib/contacts', () => ({
  upsertContact: mockUpsertContact,
}));

import { POST } from '@/app/api/contact/route';
import { getMarketConfig } from '@/i18n/market-config';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Ion',
    lastName: 'Popescu',
    email: 'ion@test.ro',
    phone: '0712345678',
    subject: 'Întrebare produs',
    message: 'Aveți produsul pe stoc?',
    ...overrides,
  };
}

// Host resolves the request to the RO market so the assertions below model
// the RON business inbox / RO sender.
function makeRequest(body: unknown, host = 'ro.shop.example.com'): Request {
  return new Request(`https://${host}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mockUpsertContact.mockResolvedValue(undefined);
  sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
});

describe('POST /api/contact', () => {
  it('400 with field issues when required fields are missing', async () => {
    const res = await POST(makeRequest({ firstName: 'Ion' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Date invalide');
    expect(body.issues.length).toBeGreaterThan(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('400 on a non-Romanian phone format', async () => {
    const res = await POST(makeRequest(validBody({ phone: '+1 555 0100' })));
    expect(res.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('500 Eroare internă on a non-JSON body (defensive catch)', async () => {
    const res = await POST(makeRequest('{not json'));
    expect(res.status).toBe(500);
  });

  it('sends to the market business inbox with the customer as replyTo, then 200', async () => {
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const marketConfig = getMarketConfig('ro');
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: marketConfig.contact.fromEmail,
        to: [marketConfig.contact.businessEmail],
        subject: 'Contact: Întrebare produs — Ion Popescu',
        replyTo: 'ion@test.ro',
      }),
    );
  });

  it('persists the contact with source contact_form', async () => {
    await POST(makeRequest(validBody()));
    expect(mockUpsertContact).toHaveBeenCalledWith('ion@test.ro', {
      firstName: 'Ion',
      lastName: 'Popescu',
      phone: '0712345678',
      source: 'contact_form',
    });
  });

  it('500 when the email send fails — the user must see the failure', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('resend 500'));
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('Eroare internă');
  });

  it('a failing contact upsert is fire-and-forget — the response is still 200', async () => {
    mockUpsertContact.mockRejectedValueOnce(new Error('mongo down'));
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // Let the dangling rejection settle inside this test (hygiene: no
    // unhandled-rejection noise leaking into the next test).
    await new Promise((r) => setTimeout(r, 0));
  });
});
