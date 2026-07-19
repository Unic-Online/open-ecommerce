import { beforeEach, describe, expect, it, vi } from 'vitest'
// Shared mock library + builders — see src/__tests__/helpers/.
import { resendLibModule, sendEmailMock } from './helpers/resend.mock'
import { buildOrder, buildOrderLine } from './helpers/builders'

const {
  mockVerifySignature,
  mockRetrieveRevolutOrder,
  mockFindOrderByProviderOrderId,
  mockFindOrderById,
  mockUpdateOrderPayment,
  mockClaimOrderEmail,
  mockMarkOrderEmailSent,
  mockReleaseOrderEmailClaim,
  mockSendServerPurchase,
  mockRecordUnknownOrderWebhook,
  mockClearUnknownOrderWebhook,
} = vi.hoisted(() => ({
  mockVerifySignature: vi.fn().mockReturnValue({ ok: true }),
  mockRetrieveRevolutOrder: vi.fn().mockResolvedValue({
    id: 'rev_order_123',
    token: 'public_token_123',
    type: 'payment',
    state: 'completed',
    amount: 31840,
    currency: 'RON',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }),
  mockFindOrderByProviderOrderId: vi.fn(),
  mockFindOrderById: vi.fn(),
  mockUpdateOrderPayment: vi.fn().mockResolvedValue({ emailAlreadySent: false, matched: true }),
  mockClaimOrderEmail: vi.fn().mockResolvedValue({ claimed: true, alreadySent: false }),
  mockMarkOrderEmailSent: vi.fn().mockResolvedValue(undefined),
  mockReleaseOrderEmailClaim: vi.fn().mockResolvedValue(undefined),
  mockSendServerPurchase: vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} }),
  mockRecordUnknownOrderWebhook: vi.fn(),
  mockClearUnknownOrderWebhook: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/revolut', () => ({
  verifyRevolutWebhookSignature: mockVerifySignature,
  retrieveRevolutOrder: mockRetrieveRevolutOrder,
}))

vi.mock('@/lib/contacts', () => ({
  findOrderByProviderOrderId: mockFindOrderByProviderOrderId,
  findOrderById: mockFindOrderById,
  updateOrderPayment: mockUpdateOrderPayment,
  claimOrderEmail: mockClaimOrderEmail,
  markOrderEmailSent: mockMarkOrderEmailSent,
  releaseOrderEmailClaim: mockReleaseOrderEmailClaim,
  recordCapiPurchaseAttempt: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/resend', () => resendLibModule())

vi.mock('@/lib/meta-capi', () => ({
  sendServerPurchase: mockSendServerPurchase,
}))

vi.mock('@/lib/webhook-inbox', () => ({
  recordUnknownOrderWebhook: mockRecordUnknownOrderWebhook,
  clearUnknownOrderWebhook: mockClearUnknownOrderWebhook,
}))

import { POST } from '@/app/api/webhooks/revolut/route'

const LOCAL_ORDER = buildOrder({
  paymentMethod: 'card',
  status: 'pending_payment',
  items: [buildOrderLine({ unitPrice: 1899 })],
  subtotal: 1899,
  discount: 380,
  totalPrice: 1519,
  payment: { provider: 'revolut', providerOrderId: 'rev_order_123' },
  tracking: {
    fbp: 'fb.1.1596403881668.1116446470.ABcDEFGh',
    fbc: 'fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890.ABcDEFGh',
    externalId: 'sf_123',
  },
})

function makeRequest(payload: Record<string, unknown>) {
  return new Request('http://localhost/api/webhooks/revolut', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'revolut-signature': 'v1=test',
      'revolut-request-timestamp': String(Date.now()),
    },
    body: JSON.stringify(payload),
  })
}

describe('Revolut webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('REVOLUT_WEBHOOK_SIGNING_SECRET', 'whsec_test_secret')
    mockVerifySignature.mockReturnValue({ ok: true })
    mockRetrieveRevolutOrder.mockResolvedValue({
      id: 'rev_order_123',
      token: 'public_token_123',
      type: 'payment',
      state: 'completed',
      amount: 31840,
      currency: 'RON',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    mockFindOrderByProviderOrderId.mockResolvedValue(LOCAL_ORDER)
    mockFindOrderById.mockResolvedValue(null)
    mockUpdateOrderPayment.mockResolvedValue({ emailAlreadySent: false, matched: true })
    mockClaimOrderEmail.mockResolvedValue({ claimed: true, alreadySent: false })
    mockMarkOrderEmailSent.mockResolvedValue(undefined)
    mockReleaseOrderEmailClaim.mockResolvedValue(undefined)
    sendEmailMock.mockResolvedValue({ data: { id: 'email_123' }, error: null })
    mockSendServerPurchase.mockResolvedValue({ ok: true, status: 200, body: {} })
    mockRecordUnknownOrderWebhook.mockResolvedValue({
      attempts: 1,
      firstSeenAt: new Date(),
      shouldGiveUp: false,
    })
    mockClearUnknownOrderWebhook.mockResolvedValue(undefined)
  })

  it('falls back to merchant_order_ext_ref when provider-order lookup misses', async () => {
    mockFindOrderByProviderOrderId.mockResolvedValueOnce(null)
    mockFindOrderById.mockResolvedValueOnce(LOCAL_ORDER)

    const res = await POST(
      makeRequest({
        event: 'ORDER_COMPLETED',
        order_id: 'rev_order_123',
        merchant_order_ext_ref: 'ABCD1234',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(mockFindOrderByProviderOrderId).toHaveBeenCalledWith('rev_order_123')
    expect(mockFindOrderById).toHaveBeenCalledWith('ABCD1234')
    // B2: status flip no longer carries markEmailSent — that moved to claimOrderEmail.
    expect(mockUpdateOrderPayment).toHaveBeenCalledWith(
      'ABCD1234',
      'paid',
      expect.objectContaining({
        providerOrderId: 'rev_order_123',
        state: 'completed',
        lastWebhookEvent: 'ORDER_COMPLETED',
      }),
      { expectedPaymentMethod: 'card' },
    )
    expect(mockClaimOrderEmail).toHaveBeenCalledWith('ABCD1234', { expectedPaymentMethod: 'card' })
    expect(sendEmailMock).toHaveBeenCalledTimes(2)
    // English-only store: webhook subjects must be English, never the
    // Romanian literals this template originally shipped with (regression).
    const [merchantSend, customerSend] = sendEmailMock.mock.calls.map((c) => c[0])
    expect(merchantSend.subject).toBe('Order paid #ABCD1234 — Acme Store')
    expect(customerSend.subject).toBe('Thank you for your order — #ABCD1234')
    expect(mockMarkOrderEmailSent).toHaveBeenCalledWith('ABCD1234')
    expect(mockReleaseOrderEmailClaim).not.toHaveBeenCalled()
    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ABCD1234',
        tracking: LOCAL_ORDER.tracking,
      })
    )
  })

  it('fires server Purchase with the persisted EUR currency (never a hard-coded RON default)', async () => {
    mockFindOrderByProviderOrderId.mockResolvedValueOnce({
      ...LOCAL_ORDER,
      currency: 'EUR',
      totalPrice: 250,
      shippingCost: 15,
      marketingConsent: true,
    })

    const res = await POST(
      makeRequest({
        event: 'ORDER_COMPLETED',
        order_id: 'rev_order_123',
      })
    )

    expect(res.status).toBe(200)
    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ABCD1234',
        totalPrice: 250,
        currency: 'EUR',
        contentName: 'Oslo Nightstand',
        shippingCost: 15,
      })
    )
  })

  it('falls back to the market config currency when an old doc lacks the currency field', async () => {
    mockFindOrderByProviderOrderId.mockResolvedValueOnce({
      ...LOCAL_ORDER,
      marketingConsent: true,
      // no `currency` on the doc -> single market config -> EUR
    })

    const res = await POST(
      makeRequest({
        event: 'ORDER_COMPLETED',
        order_id: 'rev_order_123',
      })
    )

    expect(res.status).toBe(200)
    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'EUR' })
    )
  })

  it('does not resend emails when a prior delivery already emailed the customer', async () => {
    mockClaimOrderEmail.mockResolvedValueOnce({ claimed: false, alreadySent: true })

    const res = await POST(
      makeRequest({
        event: 'ORDER_COMPLETED',
        order_id: 'rev_order_123',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ignored).toBe('already emailed')
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(mockMarkOrderEmailSent).not.toHaveBeenCalled()
    expect(mockSendServerPurchase).not.toHaveBeenCalled()
  })

  it('skips sending when another worker is mid-send within the stale window', async () => {
    mockClaimOrderEmail.mockResolvedValueOnce({ claimed: false, alreadySent: false })

    const res = await POST(
      makeRequest({
        event: 'ORDER_COMPLETED',
        order_id: 'rev_order_123',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ignored).toBe('send in flight')
    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(mockMarkOrderEmailSent).not.toHaveBeenCalled()
  })

  it('rejects invalid signatures before touching order state', async () => {
    mockVerifySignature.mockReturnValueOnce({ ok: false, reason: 'invalid signature' })

    const res = await POST(
      makeRequest({
        event: 'ORDER_COMPLETED',
        order_id: 'rev_order_123',
      })
    )
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('invalid signature')
    expect(mockFindOrderByProviderOrderId).not.toHaveBeenCalled()
    expect(mockUpdateOrderPayment).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  describe('B1: webhook unknown-order race', () => {
    beforeEach(() => {
      mockFindOrderByProviderOrderId.mockResolvedValue(null)
      mockFindOrderById.mockResolvedValue(null)
    })

    it('returns 409 (retryable) when the local order does not exist yet', async () => {
      mockRecordUnknownOrderWebhook.mockResolvedValueOnce({
        attempts: 1,
        firstSeenAt: new Date(),
        shouldGiveUp: false,
      })

      const res = await POST(
        makeRequest({
          event: 'ORDER_COMPLETED',
          order_id: 'rev_order_unknown',
          merchant_order_ext_ref: 'ZZZZ9999',
        })
      )
      const data = await res.json()

      expect(res.status).toBe(409)
      expect(data.error).toMatch(/retry/i)
      expect(mockRecordUnknownOrderWebhook).toHaveBeenCalledWith('rev_order_unknown')
      expect(mockUpdateOrderPayment).not.toHaveBeenCalled()
    })

    it('accepts as orphan and stops retrying after the retry budget is exhausted', async () => {
      mockRecordUnknownOrderWebhook.mockResolvedValueOnce({
        attempts: 5,
        firstSeenAt: new Date(),
        shouldGiveUp: true,
      })

      const res = await POST(
        makeRequest({
          event: 'ORDER_COMPLETED',
          order_id: 'rev_order_unknown',
        })
      )
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.ignored).toBe('unknown order (orphan)')
      expect(mockUpdateOrderPayment).not.toHaveBeenCalled()
    })
  })

  describe('B2: email send failure releases the claim for retry', () => {
    it('releases the claim and returns 502 when Resend throws', async () => {
      sendEmailMock.mockRejectedValueOnce(new Error('resend down'))

      const res = await POST(
        makeRequest({
          event: 'ORDER_COMPLETED',
          order_id: 'rev_order_123',
        })
      )
      const data = await res.json()

      expect(res.status).toBe(502)
      expect(data.error).toMatch(/email send failed/)
      expect(mockReleaseOrderEmailClaim).toHaveBeenCalledWith('ABCD1234', 'resend down')
      // Critical: we must NOT have marked emailSentAt — that's the bug B2 fixes.
      expect(mockMarkOrderEmailSent).not.toHaveBeenCalled()
      // Side effects (CAPI, cart-completion) must wait until email actually lands.
      expect(mockSendServerPurchase).not.toHaveBeenCalled()
    })
  })
})
