import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveCartForMarket } from '@/lib/cart-resolver'
import { computeOrderTotal } from '@/lib/pricing'
import type { CartItemData } from '@/lib/types'

function cartItem(overrides: Partial<CartItemData>): CartItemData {
  return {
    id: 'furniture__oslo-nightstand',
    productType: 'furniture',
    productName: 'Oslo Nightstand',
    quantity: 1,
    image: '/images/oslo-nightstand/1.jpg',
    unitPrice: 749,
    slug: 'oslo-nightstand',
    shortName: 'Oslo Nightstand',
    ...overrides,
  }
}

describe('resolveCartForMarket', () => {
  it('returns unknown_product for an id missing from the catalog', () => {
    const result = resolveCartForMarket(
      [cartItem({ id: 'furniture__nope', slug: 'nope' })],
      'main',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unknown_product')
      expect(result.productId).toBe('furniture__nope')
    }
  })

  it('resolves the main market against the EUR price list', () => {
    const result = resolveCartForMarket([cartItem({})], 'main')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.currency).toBe('EUR')
      expect(result.lines).toHaveLength(1)
      // EN price for oslo-nightstand = 149 EUR (sale price)
      expect(result.lines[0].unitPrice).toBe(149)
      expect(result.lines[0].currency).toBe('EUR')
    }
  })

  it('overrides client-supplied unitPrice with the catalog price', () => {
    // Tampered: client claims oslo-nightstand costs 1 EUR.
    const result = resolveCartForMarket(
      [cartItem({ unitPrice: 1 })],
      'main',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lines).toHaveLength(1)
      // Catalog price for oslo-nightstand is 149 EUR (sale price).
      expect(result.lines[0].unitPrice).toBe(149)
      expect(result.lines[0].currency).toBe('EUR')
      expect(result.currency).toBe('EUR')
      // Display fields pass through from the client.
      expect(result.lines[0].productName).toBe('Oslo Nightstand')
    }
  })
})

describe('computeOrderTotal — shipping config', () => {
  it('produces zero shipping when the shipping config has zero cost and zero threshold', () => {
    const out = computeOrderTotal(
      [{ quantity: 1, unitPrice: 100 }],
      { shipping: { standardCost: 0, freeThreshold: 0 } },
    )
    expect(out.subtotal).toBe(100)
    expect(out.shippingCost).toBe(0)
    // 100 - round(100 * 0.10) + 0 = 90
    expect(out.total).toBe(90)
  })

  it('defaults to EUR shipping (10 below the 300 free-shipping threshold)', () => {
    const out = computeOrderTotal([{ quantity: 1, unitPrice: 100 }])
    expect(out.shippingCost).toBe(10)
  })
})

// Smoke test: prove the /api/order route ignores client-supplied unitPrice
// for charging. A tampered oslo-nightstand line at 1 EUR must persist a 149 subtotal.
const {
  mockSend,
  mockUpsertOrderByCartId,
  mockFindActiveOrderByCartId,
  mockUpsertContact,
  mockMarkCompleted,
  mockRedeemCoupon,
} = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
  mockUpsertOrderByCartId: vi.fn().mockImplementation(async (args: { fallbackOrderId: string }) => ({
    orderId: args.fallbackOrderId,
    reused: false,
  })),
  mockFindActiveOrderByCartId: vi.fn().mockResolvedValue(null),
  mockUpsertContact: vi.fn().mockResolvedValue(undefined),
  mockMarkCompleted: vi.fn().mockResolvedValue(undefined),
  mockRedeemCoupon: vi.fn().mockResolvedValue(null),
}))

type ResendMockInstance = {
  emails: { send: typeof mockSend }
}

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function (this: ResendMockInstance) {
    this.emails = { send: mockSend }
  }),
}))

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  default: Promise.resolve({}),
}))

vi.mock('@/lib/contacts', () => ({
  upsertContact: mockUpsertContact,
  upsertOrderByCartId: mockUpsertOrderByCartId,
  findActiveOrderByCartId: mockFindActiveOrderByCartId,
  recordCapiPurchaseAttempt: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/revolut', () => ({
  cancelRevolutOrder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/meta-capi', () => ({
  extractClientIp: vi.fn(() => undefined),
  sendServerPurchase: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/plugins/abandoned-cart/server/carts', () => ({
  markCartCompleted: mockMarkCompleted,
}))

vi.mock('@/plugins/abandoned-cart/server/coupons', () => ({
  redeemCoupon: mockRedeemCoupon,
}))

vi.stubEnv('RESEND_API_KEY', 'test-key')

import { POST as orderPost } from '@/app/api/order/route'

function makeOrderRequest(body: unknown, host = 'localhost'): Request {
  return new Request(`http://${host}/api/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host,
    },
    body: JSON.stringify(body),
  })
}

describe('/api/order — server-trusted pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({ id: 'mock-email-id' })
    mockUpsertOrderByCartId.mockImplementation(async (args: { fallbackOrderId: string }) => ({
      orderId: args.fallbackOrderId,
      reused: false,
    }))
    mockFindActiveOrderByCartId.mockResolvedValue(null)
    mockUpsertContact.mockResolvedValue(undefined)
    mockMarkCompleted.mockResolvedValue(undefined)
    mockRedeemCoupon.mockResolvedValue(null)
  })

  it('accepts cod orders on the main market (cod is allowed) → 200', async () => {
    // The single market includes 'cod' in paymentMethods — cash on delivery
    // must succeed, not be rejected.
    const body = {
      shipping: {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@test.com',
        phone: '+447700900000',
        county: 'London',
        city: 'London',
        address: '1 Oxford Street',
        country: 'United Kingdom',
        postalCode: 'W1D 1BS',
      },
      items: [
        {
          id: 'furniture__oslo-nightstand',
          productType: 'furniture',
          productName: 'Oslo Nightstand',
          slug: 'oslo-nightstand',
          shortName: 'Oslo Nightstand',
          quantity: 1,
          unitPrice: 149,
        },
      ],
    }

    const res = await orderPost(makeOrderRequest(body, 'shop.example.com'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(mockUpsertOrderByCartId).toHaveBeenCalled()
  })

  it('persists the catalog oslo-nightstand subtotal (149) even when the client sends unitPrice: 1', async () => {
    const body = {
      shipping: {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@test.com',
        phone: '+447700900000',
        county: 'London',
        city: 'London',
        address: '1 Oxford Street',
        country: 'United Kingdom',
        postalCode: 'W1D 1BS',
      },
      items: [
        {
          // Tampered cart payload — server must ignore this unitPrice.
          id: 'furniture__oslo-nightstand',
          productType: 'furniture',
          productName: 'Oslo Nightstand',
          slug: 'oslo-nightstand',
          shortName: 'Oslo Nightstand',
          quantity: 1,
          unitPrice: 1,
        },
      ],
      totalPrice: 1,
    }

    const res = await orderPost(makeOrderRequest(body, 'shop.example.com'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockUpsertOrderByCartId).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@test.com',
        orderData: expect.objectContaining({
          // Server-trust: catalog price wins, not the tampered unitPrice.
          subtotal: 149,
        }),
      }),
    )
    const savedItems = mockUpsertOrderByCartId.mock.calls[0][0].orderData.items
    expect(savedItems).toHaveLength(1)
    expect(savedItems[0].unitPrice).toBe(149)
  })
})
