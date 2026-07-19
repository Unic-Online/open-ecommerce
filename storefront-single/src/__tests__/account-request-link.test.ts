/**
 * /api/account/request-link — POST { email }
 *
 *  Contract:
 *  - Always returns 200 ok:true (no enumeration: caller cannot tell whether
 *    the email exists in our orders collection).
 *  - Sends magic-link email via sendEmail() ONLY if at least one order with
 *    that email exists.
 *  - Rate-limits per email: max 3 requests per hour. Excess returns 429.
 *  - Validates email format; malformed input returns 400.
 *  - Stores token nonce in Mongo so /verify can enforce single-use.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSend,
  mockCountOrdersByEmail,
  mockRecordRequest,
  mockCountRecentRequests,
  mockRecordIssuedToken,
  afterMock,
  capturedAfter,
  autoRunAfter,
} = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ data: { id: 'magic-link-id' }, error: null }),
  mockCountOrdersByEmail: vi.fn().mockResolvedValue(1),
  mockRecordRequest: vi.fn().mockResolvedValue(undefined),
  mockCountRecentRequests: vi.fn().mockResolvedValue(0),
  mockRecordIssuedToken: vi.fn().mockResolvedValue(undefined),
  afterMock: vi.fn(),
  // Captured `after()` callbacks + a flag controlling whether the mock runs
  // them eagerly. Default (eager) keeps the rest of the suite asserting the
  // send synchronously; the deferral test flips it off to inspect the gap
  // between "response returned" and "after() queue flushed".
  capturedAfter: [] as Array<() => unknown>,
  autoRunAfter: { value: true },
}));

vi.mock('@/lib/resend', () => ({
  sendEmail: mockSend,
  getResend: vi.fn(),
}));

// Mock `next/server` to intercept `after()` (keeping the real NextResponse).
// On Vercel `after()` is what keeps the function instance alive past the
// response so the deferred Resend send actually completes; a bare
// fire-and-forget would be frozen mid-flight. Capturing the callback lets us
// assert the send is wrapped in `after()` and runs only when the queue flushes.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (cb: () => unknown) => {
      afterMock(cb);
      capturedAfter.push(cb);
      if (autoRunAfter.value) return cb();
    },
  };
});

vi.mock('@/lib/account-tokens', () => ({
  countOrdersByEmail: mockCountOrdersByEmail,
  recordRequest: mockRecordRequest,
  countRecentRequests: mockCountRecentRequests,
  recordIssuedToken: mockRecordIssuedToken,
  consumeToken: vi.fn(),
}));

vi.stubEnv('CART_RECOVERY_HMAC_SECRET', 'request-link-test-secret-1234567890');

import { POST } from '@/app/api/account/request-link/route';

function makeRequest(body: unknown, locale = 'ro'): Request {
  return new Request('http://localhost/api/account/request-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-locale': locale },
    body: JSON.stringify(body),
  });
}

describe('/api/account/request-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountOrdersByEmail.mockResolvedValue(1);
    mockCountRecentRequests.mockResolvedValue(0);
    mockSend.mockResolvedValue({ data: { id: 'magic-link-id' }, error: null });
    capturedAfter.length = 0;
    autoRunAfter.value = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 ok:true and sends magic link when email has orders', async () => {
    const res = await POST(makeRequest({ email: 'ion@test.ro' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockRecordIssuedToken).toHaveBeenCalledTimes(1);
  });

  it('returns 200 ok:true but does NOT send when email has no orders (no enumeration)', async () => {
    mockCountOrdersByEmail.mockResolvedValue(0);
    const res = await POST(makeRequest({ email: 'unknown@test.ro' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordIssuedToken).not.toHaveBeenCalled();
  });

  it('lowercases email before lookup', async () => {
    mockCountOrdersByEmail.mockResolvedValue(1);
    await POST(makeRequest({ email: 'Ion@Test.RO' }));
    expect(mockCountOrdersByEmail).toHaveBeenCalledWith('ion@test.ro');
  });

  it('rejects malformed email with 400', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects missing email with 400', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('rate-limits to 3 requests per email per hour', async () => {
    mockCountRecentRequests.mockResolvedValue(3);
    const res = await POST(makeRequest({ email: 'ion@test.ro' }));
    expect(res.status).toBe(429);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('records the request attempt for rate-limit accounting BEFORE checking orders', async () => {
    await POST(makeRequest({ email: 'ion@test.ro' }));
    expect(mockRecordRequest).toHaveBeenCalledWith('ion@test.ro');
  });

  it('magic link URL includes a verify route + token query param', async () => {
    await POST(makeRequest({ email: 'ion@test.ro' }));
    const args = mockSend.mock.calls[0][0];
    const html = String(args.html ?? '');
    expect(html).toMatch(/\/api\/account\/verify\?token=[A-Za-z0-9._-]+/);
  });

  it('email subject + sender are configured (deliverability)', async () => {
    await POST(makeRequest({ email: 'ion@test.ro' }));
    const args = mockSend.mock.calls[0][0];
    expect(args.from).toBeTruthy();
    expect(args.to).toEqual(['ion@test.ro']);
    expect(args.subject).toBeTruthy();
  });

  it('returns 503 when HMAC secret missing (configuration gate)', async () => {
    const orig = process.env.CART_RECOVERY_HMAC_SECRET;
    delete process.env.CART_RECOVERY_HMAC_SECRET;
    try {
      const res = await POST(makeRequest({ email: 'ion@test.ro' }));
      expect(res.status).toBe(503);
    } finally {
      process.env.CART_RECOVERY_HMAC_SECRET = orig;
    }
  });

  // Regression: the send MUST be deferred through `after()`, not fired on the
  // response path. A bare fire-and-forget (`sendEmail(...).catch(...)`) is
  // frozen mid-flight by Vercel once the response returns, so the email never
  // reaches Resend even though the nonce was recorded. These tests fail if the
  // route reverts to calling sendEmail directly.
  it('wraps the magic-link send in after() so Vercel does not drop it', async () => {
    await POST(makeRequest({ email: 'ion@test.ro' }));
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(afterMock).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does NOT call after() when there is no email to send', async () => {
    mockCountOrdersByEmail.mockResolvedValue(0);
    await POST(makeRequest({ email: 'unknown@test.ro' }));
    expect(afterMock).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('defers the send: nothing is sent on the response path, only when the after() queue flushes', async () => {
    autoRunAfter.value = false; // simulate Vercel: capture the callback, do not run it yet
    const res = await POST(makeRequest({ email: 'ion@test.ro' }));

    // Response is already returned (constant-time, no enumeration tell) but the
    // send has NOT executed — proving it is off the response path.
    expect(res.status).toBe(200);
    expect(mockSend).not.toHaveBeenCalled();
    expect(capturedAfter).toHaveLength(1);

    // Vercel flushes the after() queue while the instance is kept alive.
    await capturedAfter[0]();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toEqual(['ion@test.ro']);
  });
});
