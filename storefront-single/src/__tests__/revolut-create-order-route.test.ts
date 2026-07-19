import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUpsertOrderByCartId,
  mockFindActiveOrderByCartId,
  mockUpsertContact,
  mockUpdateOrderPayment,
  mockCreateRevolutOrder,
  mockCancelRevolutOrder,
} = vi.hoisted(() => ({
  mockUpsertOrderByCartId: vi.fn().mockImplementation(async (args: { fallbackOrderId: string }) => ({
    orderId: args.fallbackOrderId,
    reused: false,
  })),
  mockFindActiveOrderByCartId: vi.fn().mockResolvedValue(null),
  mockUpsertContact: vi.fn().mockResolvedValue(undefined),
  mockUpdateOrderPayment: vi.fn().mockResolvedValue({ emailAlreadySent: false }),
  mockCreateRevolutOrder: vi.fn().mockResolvedValue({
    id: 'rev_order_123',
    token: 'public_order_token_123',
    type: 'payment',
    state: 'pending',
    // oslo-nightstand EUR: subtotal=149, discount=15, shippingCost=10, total=144, amountMinor=14400
    amount: 14400,
    currency: 'EUR',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }),
  mockCancelRevolutOrder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/contacts', () => ({
  upsertOrderByCartId: mockUpsertOrderByCartId,
  findActiveOrderByCartId: mockFindActiveOrderByCartId,
  upsertContact: mockUpsertContact,
  updateOrderPayment: mockUpdateOrderPayment,
}))

vi.mock('@/lib/revolut', () => ({
  createRevolutOrder: mockCreateRevolutOrder,
  cancelRevolutOrder: mockCancelRevolutOrder,
}))

import { POST } from '@/app/api/payments/revolut/create-order/route'

// Demo catalog — main market EUR prices:
//   furniture__oslo-nightstand  149 EUR
//   subtotal=149, discount=round(149*0.10)=15, shipping=10 (149<300 threshold)
//   totalPrice=144, amountMinor=14400

function createValidBody() {
  return {
    shipping: {
      firstName: 'Ion',
      lastName: 'Popescu',
      email: 'ion@test.ro',
      phone: '+40712345678',
      county: 'Ilfov',
      city: 'București',
      address: 'Str. Test nr. 10',
      country: 'România',
      postalCode: '012345',
    },
    items: [
      {
        id: 'furniture__oslo-nightstand',
        productType: 'furniture',
        productName: 'Oslo Nightstand',
        slug: 'oslo-nightstand',
        shortName: 'Oslo Nightstand',
        quantity: 1,
        // Catalog oslo-nightstand is 149 EUR; server resolver overrides this for charging.
        unitPrice: 149,
      },
    ],
    paymentMethod: 'card',
  }
}

function makeRequest(body: unknown): Request {
  return new Request('http://shop.example.com/api/payments/revolut/create-order', {
    method: 'POST',
    // host header resolves the request to the main market (EUR pricing).
    headers: { 'Content-Type': 'application/json', host: 'shop.example.com' },
    body: JSON.stringify(body),
  })
}

describe('Revolut create-order API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertOrderByCartId.mockImplementation(async (args: { fallbackOrderId: string }) => ({
      orderId: args.fallbackOrderId,
      reused: false,
    }))
    mockFindActiveOrderByCartId.mockResolvedValue(null)
    mockUpsertContact.mockResolvedValue(undefined)
    mockUpdateOrderPayment.mockResolvedValue({ emailAlreadySent: false })
    mockCancelRevolutOrder.mockResolvedValue(undefined)
    mockCreateRevolutOrder.mockResolvedValue({
      id: 'rev_order_123',
      token: 'public_order_token_123',
      type: 'payment',
      state: 'pending',
      amount: 14400,
      currency: 'EUR',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
  })

  it('persists the order before calling Revolut', async () => {
    const res = await POST(makeRequest(createValidBody()))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.publicId).toBe('public_order_token_123')
    expect(mockUpsertOrderByCartId).toHaveBeenCalledTimes(1)
    expect(mockCreateRevolutOrder).toHaveBeenCalledTimes(1)
    expect(mockUpsertOrderByCartId.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateRevolutOrder.mock.invocationCallOrder[0]
    )
    expect(mockUpsertOrderByCartId).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ion@test.ro',
        orderData: expect.objectContaining({
          // Server-trust: subtotal comes from the catalog price (149 EUR), not the
          // client wire payload.
          subtotal: 149,
          // round(149 * 0.10) = 15
          discount: 15,
          shippingCost: 10,
          totalPrice: 144,
          payment: expect.objectContaining({ amountMinor: 14400 }),
        }),
      })
    )
    expect(mockCreateRevolutOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 14400,
        currency: 'EUR',
      })
    )
  })

  it('returns success even when checkout_url is missing, as long as token exists', async () => {
    const res = await POST(makeRequest(createValidBody()))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      orderId: expect.stringMatching(/^[0-9A-F]{8}$/),
      publicId: 'public_order_token_123',
      providerOrderId: 'rev_order_123',
    })
    expect(data.checkoutUrl).toBeUndefined()
    expect(mockUpdateOrderPayment).toHaveBeenCalledWith(
      expect.any(String),
      'pending_payment',
      expect.objectContaining({
        providerOrderId: 'rev_order_123',
        providerPublicId: 'public_order_token_123',
        providerCheckoutUrl: undefined,
        state: 'pending',
      })
    )
  })

  it('persists Meta browser tracking IDs before Revolut webhook fires Purchase CAPI', async () => {
    const tracking = {
      fbp: 'fb.1.1596403881668.1116446470.ABcDEFGh',
      fbc: 'fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890.ABcDEFGh',
      externalId: 'sf_123',
    }

    const res = await POST(makeRequest({
      ...createValidBody(),
      marketingConsent: true,
      tracking,
    }))

    expect(res.status).toBe(200)
    expect(mockUpsertOrderByCartId).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ion@test.ro',
        orderData: expect.objectContaining({
          marketingConsent: true,
          tracking,
        }),
      })
    )
  })

  it('fails before calling Revolut when order persistence fails', async () => {
    mockUpsertOrderByCartId.mockRejectedValueOnce(new Error('MongoDB unavailable'))

    const res = await POST(makeRequest(createValidBody()))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toContain('Internal error')
    expect(mockCreateRevolutOrder).not.toHaveBeenCalled()
  })

  it('marks the order as failed when Revolut createOrder errors', async () => {
    mockCreateRevolutOrder.mockRejectedValueOnce(new Error('Provider outage'))

    const res = await POST(makeRequest(createValidBody()))
    const data = await res.json()

    expect(res.status).toBe(502)
    expect(data.error).toContain('Could not start the card payment')
    expect(mockUpdateOrderPayment).toHaveBeenCalledWith(
      expect.any(String),
      'failed',
      expect.objectContaining({
        state: 'failed',
        lastWebhookEvent: 'CREATE_ORDER_FAILED',
      })
    )
  })

  describe('B3: Revolut session hardening', () => {
    it('passes an Idempotency-Key derived from orderId so retried POSTs are de-duped at the provider', async () => {
      await POST(makeRequest(createValidBody()))

      expect(mockCreateRevolutOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/^order:[0-9A-F]{8}:14400$/),
        }),
      )
    })

    it('cancels EVERY previous Revolut session — not just the most recent — when reusing an order', async () => {
      mockUpsertOrderByCartId.mockResolvedValueOnce({
        orderId: 'REUSE001',
        reused: true,
        previous: {
          payment: {
            providerOrderId: 'rev_session_C',
            previousProviderOrderIds: ['rev_session_A', 'rev_session_B'],
          },
        },
      })

      const res = await POST(makeRequest(createValidBody()))
      expect(res.status).toBe(200)

      const cancelledIds = mockCancelRevolutOrder.mock.calls.map(call => call[0])
      expect(new Set(cancelledIds)).toEqual(new Set(['rev_session_A', 'rev_session_B', 'rev_session_C']))
    })

    it('persists previousProviderOrderIds so the next prepare can cancel them too', async () => {
      mockUpsertOrderByCartId.mockResolvedValueOnce({
        orderId: 'REUSE002',
        reused: true,
        previous: {
          payment: {
            providerOrderId: 'rev_session_C',
            previousProviderOrderIds: ['rev_session_A'],
          },
        },
      })

      await POST(makeRequest(createValidBody()))

      const pendingCall = mockUpdateOrderPayment.mock.calls.find(
        call => call[1] === 'pending_payment',
      )
      expect(pendingCall).toBeDefined()
      const paymentArg = pendingCall![2] as { previousProviderOrderIds?: string[] }
      expect(new Set(paymentArg.previousProviderOrderIds ?? [])).toEqual(
        new Set(['rev_session_A', 'rev_session_C']),
      )
    })
  })
})
