import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared mock library + builders — see src/__tests__/helpers/.
import { mongoMock } from './helpers/mongodb.mock';
import { resendPackageModule, sendEmailMock } from './helpers/resend.mock';
import { buildShipping, buildCartItem } from './helpers/builders';

// vi.mock is hoisted — we can't reference variables defined before it.
// Instead, use vi.hoisted to define the mock function.
const { mockUpsertOrderByCartId, mockFindActiveOrderByCartId, mockSendServerPurchase, mockCaptureError, mockCancelRevolutOrder } = vi.hoisted(() => ({
  mockCaptureError: vi.fn(),
  mockCancelRevolutOrder: vi.fn().mockResolvedValue(undefined),
  mockSendServerPurchase: vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} }),
  mockUpsertOrderByCartId: vi.fn().mockImplementation(async (args: { fallbackOrderId: string }) => ({
    orderId: args.fallbackOrderId,
    reused: false,
  })),
  mockFindActiveOrderByCartId: vi.fn().mockResolvedValue(null),
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

vi.mock('@/lib/meta-capi', () => ({
  extractClientIp: vi.fn(() => undefined),
  sendServerPurchase: mockSendServerPurchase,
}));

vi.mock('@/plugins/abandoned-cart/server/carts', () => ({
  markCartCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/plugins/abandoned-cart/server/coupons', () => ({
  redeemCoupon: vi.fn().mockResolvedValue(null),
}));

// Set env before importing
vi.stubEnv('RESEND_API_KEY', 'test-key');

import { POST } from '@/app/api/order/route';

// Demo catalog — main market EUR prices:
//   furniture__oslo-nightstand  149 EUR  (≥300 free shipping)
//   furniture__aria-console     249 EUR  (≥300 free shipping)
//   outdoor__terra-path-light    69 EUR  (<300 → €10 shipping)

function createValidOrderBody() {
  return {
    shipping: buildShipping(),
    // Catalog oslo-nightstand is 149 EUR (the builder default); the server
    // resolver overrides whatever we send here, but keep this matching the
    // catalog so the test isn't unintentionally exercising the tampering path.
    items: [buildCartItem()],
    totalPrice: 149,
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://shop.example.com/api/order', {
    method: 'POST',
    // host header resolves the request to the main market (EUR pricing).
    headers: { 'Content-Type': 'application/json', host: 'shop.example.com' },
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
    mockSendServerPurchase.mockResolvedValue({ ok: true, status: 200, body: {} });
  });

  it('fires server Purchase with the market currency — never a hard-coded RON default', async () => {
    const body = { ...createValidOrderBody(), marketingConsent: true };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);

    expect(mockSendServerPurchase).toHaveBeenCalledTimes(1);
    // Single market is EUR. The call site must pass the market's currency
    // explicitly; relying on a RON default inside meta-capi is the bug.
    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'EUR',
        // subtotal=149, discount=15, shippingCost=10, total=144
        totalPrice: 144,
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
        shippingCost: 10,
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
    expect(merchantEmail.subject).toMatch(/New order #[0-9A-F]{8} — Acme Store/);
    expect(merchantEmail.replyTo).toBe('ion@test.ro');
    expect(merchantEmail.html).toContain('Oslo Nightstand');
    // 149 - round(149 * 0.10) = 149 - 15 = 134 (free shipping ≥300 threshold: 149 < 300, so +10)
    // subtotal=149, discount=15, shippingCost=10, total=144
    expect(merchantEmail.html).toContain('€144');

    expect(customerEmail.to).toEqual(['ion@test.ro']);
    expect(customerEmail.subject).toMatch(/Your order — #[0-9A-F]{8}/);
  });

  it('email HTML includes shipping address', async () => {
    await POST(makeRequest(createValidOrderBody()));
    const emailArgs = sendEmailMock.mock.calls[0][0];

    expect(emailArgs.html).toContain('Ion Popescu');
    expect(emailArgs.html).toContain('ion@test.ro');
    expect(emailArgs.html).toContain('+40712345678');
    expect(emailArgs.html).toContain('Str. Test nr. 10');
    expect(emailArgs.html).toContain('București');
    expect(emailArgs.html).toContain('Cash on delivery');
  });

  it('email HTML includes product details and computed price', async () => {
    await POST(makeRequest(createValidOrderBody()));
    const emailArgs = sendEmailMock.mock.calls[0][0];

    // subtotal=149, discount=15, shippingCost=10, total=144
    expect(emailArgs.html).toContain('€144');
    expect(emailArgs.html).toContain('Oslo Nightstand');
  });

  it('persists server-computed shipping and ignores client-supplied totals', async () => {
    const body = createValidOrderBody();
    // terra-path-light catalog price is 69 EUR — below the 300 free-shipping
    // threshold, so it exercises the standard €10 shipping branch.
    body.items = [
      buildCartItem({
        id: 'outdoor__terra-path-light',
        productType: 'outdoor',
        productName: 'Terra Path Light',
        slug: 'terra-path-light',
        shortName: 'Terra Path Light',
        // Tampered: server must override with 69 (catalog).
        unitPrice: 100,
      }),
    ];
    body.totalPrice = 1;

    const res = await POST(makeRequest(body));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Server-trust: 69 - round(69 * 0.10) + 10 = 69 - 7 + 10 = 72
    expect(data).toMatchObject({ success: true, shippingCost: 10, totalPrice: 72 });
    expect(mockUpsertOrderByCartId).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ion@test.ro',
        orderData: expect.objectContaining({
          subtotal: 69,
          discount: 7,
          shippingCost: 10,
          totalPrice: 72,
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
    expect(data.error).toBe('Missing data');
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
    expect(data.error).toContain('Internal error');
  });

  it('handles multiple items in one order', async () => {
    const body = createValidOrderBody();
    body.items.push(
      buildCartItem({
        id: 'furniture__aria-console',
        productName: 'Aria Console',
        slug: 'aria-console',
        shortName: 'Aria Console',
        // Catalog aria-console is 249 EUR; server overrides whatever this is.
        unitPrice: 249,
      }),
    );
    body.totalPrice = 149 + 249;

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
