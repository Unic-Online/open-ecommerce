import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared mock library + builders (issue #20) — see src/__tests__/helpers/.
import { mongoMock } from './helpers/mongodb.mock';
import { resendPackageModule, sendEmailMock } from './helpers/resend.mock';
import { buildShipping, buildCartItem } from './helpers/builders';
import { formatMoney } from '@/lib/format';

// vi.mock is hoisted — we can't reference variables defined before it.
// Instead, use vi.hoisted to define the mock function.
const { mockUpsertOrderByCartId, mockFindActiveOrderByCartId, mockCaptureError, mockCancelRevolutOrder, mockSendServerPurchase } = vi.hoisted(() => ({
  mockUpsertOrderByCartId: vi.fn().mockImplementation(async (args: { fallbackOrderId: string }) => ({
    orderId: args.fallbackOrderId,
    reused: false,
  })),
  mockFindActiveOrderByCartId: vi.fn().mockResolvedValue(null),
  mockCaptureError: vi.fn(),
  mockCancelRevolutOrder: vi.fn().mockResolvedValue(undefined),
  mockSendServerPurchase: vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} }),
}));

vi.mock('resend', () => resendPackageModule());

// Mock MongoDB and contacts — no real DB needed in tests
vi.mock('@/lib/mongodb', () => mongoMock.module());

vi.mock('@/lib/contacts', () => ({
  upsertContact: vi.fn().mockResolvedValue(undefined),
  upsertOrderByCartId: mockUpsertOrderByCartId,
  findActiveOrderByCartId: mockFindActiveOrderByCartId,
  recordCapiPurchaseAttempt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/revolut', () => ({
  cancelRevolutOrder: mockCancelRevolutOrder,
}));

vi.mock('@/lib/error-sink', () => ({
  captureError: mockCaptureError,
}));

vi.mock('@/lib/meta-capi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/meta-capi')>('@/lib/meta-capi');
  return {
    ...actual,
    sendServerPurchase: mockSendServerPurchase,
  };
});

// Set env before importing
vi.stubEnv('RESEND_API_KEY', 'test-key');

import { POST } from '@/app/api/order/route';

function createValidOrderBody() {
  return {
    shipping: buildShipping(),
    // Catalog oslo-nightstand is 749 RON for the ro market (the builder
    // default); the server resolver overrides whatever we send here, but
    // keep this matching the catalog so the test isn't unintentionally
    // exercising the tampering path.
    items: [buildCartItem()],
    totalPrice: 749,
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/order', {
    method: 'POST',
    // host header resolves the request to the RO market (RON pricing, RO
    // sender). Without it the request falls back to DEFAULT_MARKET
    // ('english', EUR), which these RON assertions don't model.
    headers: { 'Content-Type': 'application/json', host: 'ro.shop.example.com' },
    body: JSON.stringify(body),
  });
}

describe('Order API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmailMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null });
    mockUpsertOrderByCartId.mockImplementation(async (args: { fallbackOrderId: string }) => ({
      orderId: args.fallbackOrderId,
      reused: false,
    }));
    mockFindActiveOrderByCartId.mockResolvedValue(null);
    mockCancelRevolutOrder.mockResolvedValue(undefined);
    mockSendServerPurchase.mockResolvedValue({ ok: true, status: 200, body: {} });
  });

  it('fires server Purchase with the market currency — never a hard-coded RON default', async () => {
    const body = { ...createValidOrderBody(), marketingConsent: true };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);

    expect(mockSendServerPurchase).toHaveBeenCalledTimes(1);
    // RO host → RON. The call site must pass the market's currency
    // explicitly; relying on a default inside meta-capi is the bug.
    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'RON',
        totalPrice: 674,
        marketingConsent: true,
      }),
    );
  });

  it('fires server Purchase with content_name and shipping cost (recommended fields)', async () => {
    const body = { ...createValidOrderBody(), marketingConsent: true };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);

    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        contentName: 'Oslo Nightstand',
        // 749 subtotal ≥ 600 → free shipping; the field must still be sent as 0.
        shippingCost: 0,
      }),
    );
  });

  it('creates order and returns 8-char hex orderId', async () => {
    const res = await POST(makeRequest(createValidOrderBody()));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.orderId).toMatch(/^[0-9A-F]{8}$/);
  });

  it('sends merchant + customer emails via Resend', async () => {
    await POST(makeRequest(createValidOrderBody()));

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const merchantEmail = sendEmailMock.mock.calls[0][0];
    const customerEmail = sendEmailMock.mock.calls[1][0];

    expect(merchantEmail.from).toBe('Acme Store <orders@example.com>');
    expect(merchantEmail.to).toEqual(['contact@example.com']);
    expect(merchantEmail.subject).toMatch(/Comandă nouă #[0-9A-F]{8} — Acme Store/);
    expect(merchantEmail.replyTo).toBe('ion@test.ro');
    expect(merchantEmail.html).toContain('Oslo Nightstand');
    // 749 - round(749 * 0.10) = 749 - 75 = 674 (free shipping ≥600 threshold)
    // Money is Intl-formatted in the order currency (market-aware fix).
    expect(merchantEmail.html).toContain(formatMoney(674, 'RON', 'ro'));

    expect(customerEmail.to).toEqual(['ion@test.ro']);
    expect(customerEmail.subject).toMatch(/Comanda ta — #[0-9A-F]{8}/);
  });

  it('email HTML includes shipping address', async () => {
    await POST(makeRequest(createValidOrderBody()));
    const emailArgs = sendEmailMock.mock.calls[0][0];

    expect(emailArgs.html).toContain('Ion Popescu');
    expect(emailArgs.html).toContain('ion@test.ro');
    expect(emailArgs.html).toContain('+40712345678');
    expect(emailArgs.html).toContain('Str. Test nr. 10');
    expect(emailArgs.html).toContain('București');
    expect(emailArgs.html).toContain('Ramburs (la livrare)');
  });

  it('email HTML includes product details and computed price', async () => {
    await POST(makeRequest(createValidOrderBody()));
    const emailArgs = sendEmailMock.mock.calls[0][0];

    // 749 - round(749 * 0.10) = 749 - 75 = 674 (free shipping ≥600 threshold)
    expect(emailArgs.html).toContain(formatMoney(674, 'RON', 'ro'));
    expect(emailArgs.html).toContain('Oslo Nightstand');
  });

  it('persists server-computed shipping and ignores client-supplied totals', async () => {
    const body = createValidOrderBody();
    // terra-path-light catalog price is 349 RON — below the 600 free-shipping
    // threshold, so it exercises the standard 29 RON shipping branch.
    body.items = [
      buildCartItem({
        id: 'outdoor__terra-path-light',
        productType: 'outdoor',
        productName: 'Terra Path Light',
        slug: 'terra-path-light',
        shortName: 'Terra Path Light',
        // Tampered: server must override with 349 (catalog).
        unitPrice: 100,
      }),
    ];
    body.totalPrice = 1;

    const res = await POST(makeRequest(body));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Server-trust: 349 - round(349 * 0.10) + 29 = 349 - 35 + 29 = 343
    expect(data).toMatchObject({ success: true, shippingCost: 29, totalPrice: 343 });
    expect(mockUpsertOrderByCartId).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ion@test.ro',
        orderData: expect.objectContaining({
          subtotal: 349,
          discount: 35,
          shippingCost: 29,
          totalPrice: 343,
        }),
      })
    );
  });

  it('persists Meta browser tracking IDs for server-side Purchase CAPI', async () => {
    const tracking = {
      fbp: 'fb.1.1596403881668.1116446470.ABcDEFGh',
      fbc: 'fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890.ABcDEFGh',
      externalId: 'sf_123',
    };
    const body = {
      ...createValidOrderBody(),
      marketingConsent: true,
      tracking,
    };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockUpsertOrderByCartId).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ion@test.ro',
        orderData: expect.objectContaining({
          marketingConsent: true,
          tracking,
        }),
      })
    );
  });

  it('returns 400 when shipping is missing', async () => {
    const res = await POST(makeRequest({ items: [{}], totalPrice: 100 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Date lipsă');
  });

  it('returns 400 when items array is empty', async () => {
    const body = createValidOrderBody();
    body.items = [];
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('generates unique order IDs', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const res = await POST(makeRequest(createValidOrderBody()));
      const data = await res.json();
      ids.add(data.orderId);
    }
    // At least 15 unique out of 20 (collision is possible but extremely unlikely)
    expect(ids.size).toBeGreaterThanOrEqual(15);
  });

  it('handles Resend failure gracefully', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('Resend network error'));
    const res = await POST(makeRequest(createValidOrderBody()));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Eroare internă');
  });

  it('handles multiple items in one order', async () => {
    const body = createValidOrderBody();
    // Catalog aria-console is 1249 RON; server overrides whatever this is.
    body.items.push(
      buildCartItem({
        id: 'furniture__aria-console',
        productName: 'Aria Console',
        slug: 'aria-console',
        shortName: 'Aria Console',
        unitPrice: 1249,
      }),
    );
    body.totalPrice = 749 + 1249;

    const res = await POST(makeRequest(body));
    const data = await res.json();
    expect(data.success).toBe(true);

    const emailArgs = sendEmailMock.mock.calls[0][0];
    expect(emailArgs.html).toContain('Aria Console');
  });

  it('routes cancelRevolutOrder failure through captureError, not console.error', async () => {
    const cancelErr = new Error('Provider gone');
    mockCancelRevolutOrder.mockRejectedValueOnce(cancelErr);
    mockUpsertOrderByCartId.mockResolvedValueOnce({
      orderId: 'REUSE001',
      reused: true,
      previous: { payment: { providerOrderId: 'rev_old_123' } },
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await POST(makeRequest(createValidOrderBody()));
    // Allow the fire-and-forget .catch() microtask to settle.
    await Promise.resolve();

    expect(mockCaptureError).toHaveBeenCalledWith(
      cancelErr,
      expect.objectContaining({ previousProviderOrderId: 'rev_old_123' }),
      expect.objectContaining({ tag: 'revolut_cancel_previous' }),
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('cancel'),
      cancelErr,
    );
    consoleSpy.mockRestore();
  });
});
