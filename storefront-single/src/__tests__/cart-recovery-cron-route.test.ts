/**
 * Auth gate for GET/POST /api/cron/cart-recovery.
 *
 * The route must refuse everything unless the request carries
 * `Authorization: Bearer <CART_RECOVERY_CRON_SECRET>` AND the secret is
 * actually configured — an unset secret must NOT mean "open endpoint".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRunRecoveryCron } = vi.hoisted(() => ({
  mockRunRecoveryCron: vi.fn(),
}));

vi.mock('@/plugins/abandoned-cart/server/recovery-cron', () => ({
  runRecoveryCron: mockRunRecoveryCron,
}));

import { GET, POST } from '@/app/api/cron/cart-recovery/route';

const CRON_RESULT = {
  abandoned: 2,
  step1Sent: 1,
  step2Sent: 0,
  step3Sent: 0,
  errors: [],
  dryRun: false,
};

function makeRequest(authorization?: string): Request {
  return new Request('http://localhost/api/cron/cart-recovery', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  mockRunRecoveryCron.mockResolvedValue(CRON_RESULT);
  vi.stubEnv('CART_RECOVERY_CRON_SECRET', 'cron-secret-123');
});

describe('GET /api/cron/cart-recovery — auth gate', () => {
  it('403 when the Authorization header is missing; cron not invoked', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(mockRunRecoveryCron).not.toHaveBeenCalled();
  });

  it('403 on a wrong bearer token; cron not invoked', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(403);
    expect(mockRunRecoveryCron).not.toHaveBeenCalled();
  });

  it('403 when the secret is sent raw (without the Bearer scheme)', async () => {
    const res = await GET(makeRequest('cron-secret-123'));
    expect(res.status).toBe(403);
    expect(mockRunRecoveryCron).not.toHaveBeenCalled();
  });

  it('403 when the secret env is NOT configured, even if the header "matches" — unset secret must not mean open endpoint', async () => {
    vi.stubEnv('CART_RECOVERY_CRON_SECRET', '');
    const res = await GET(makeRequest('Bearer '));
    expect(res.status).toBe(403);
    expect(mockRunRecoveryCron).not.toHaveBeenCalled();
  });

  it('200 with the cron result on the correct bearer token', async () => {
    const res = await GET(makeRequest('Bearer cron-secret-123'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(CRON_RESULT);
    expect(mockRunRecoveryCron).toHaveBeenCalledTimes(1);
  });

  it('POST is an alias of GET (manual curl triggers) with the same gate', async () => {
    expect(POST).toBe(GET);
    const denied = await POST(makeRequest('Bearer nope'));
    expect(denied.status).toBe(403);
    const allowed = await POST(makeRequest('Bearer cron-secret-123'));
    expect(allowed.status).toBe(200);
  });
});
