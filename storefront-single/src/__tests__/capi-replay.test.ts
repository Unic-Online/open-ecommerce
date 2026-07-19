import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Db } from 'mongodb'
import { checkoutPaymentExperimentParams } from '@/lib/ab-testing'

const { mockSendServerPurchase, mockRecordAttempt, mockCaptureError, mockAbsoluteUrl } = vi.hoisted(() => ({
  mockSendServerPurchase: vi.fn(),
  mockRecordAttempt: vi.fn(),
  mockCaptureError: vi.fn(),
  mockAbsoluteUrl: vi.fn((path: string) => `https://shop.example.test${path}`),
}))

vi.mock('@/lib/meta-capi', () => ({
  sendServerPurchase: mockSendServerPurchase,
}))

vi.mock('@/lib/contacts', () => ({
  recordCapiPurchaseAttempt: mockRecordAttempt,
}))

vi.mock('@/lib/error-sink', () => ({
  captureError: mockCaptureError,
}))

vi.mock('@/lib/market', async () => {
  const actual = await vi.importActual<typeof import('@/lib/market')>('@/lib/market')
  return {
    ...actual,
    absoluteUrl: mockAbsoluteUrl,
  }
})

import {
  BATCH_LIMIT,
  MAX_AGE_MS,
  MAX_ATTEMPTS,
  buildEligibilityFilter,
  runCapiReplay,
} from '@/lib/orders/capi-replay'
import { ORDERS_COLLECTION } from '@/lib/orders/types'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'AAAA1111',
    currency: 'EUR',
    paymentMethod: 'cod',
    status: 'received',
    marketingConsent: true,
    shipping: {
      firstName: 'Ion',
      lastName: 'Popescu',
      email: 'ion@test.ro',
      phone: '0712345678',
      county: 'Ilfov',
      city: 'București',
      address: 'Str. Test 10',
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
        quantity: 2,
        unitPrice: 100,
      },
    ],
    totalPrice: 200,
    shippingCost: 10,
    clientIp: '203.0.113.42',
    clientUserAgent: 'Mozilla/5.0 Test',
    tracking: { fbp: 'fb.1.123.456', externalId: 'sf_42' },
    ...overrides,
  }
}

function makeDb(orders: Array<Record<string, unknown>>) {
  const toArray = vi.fn().mockResolvedValue(orders)
  const limit = vi.fn().mockReturnValue({ toArray })
  const find = vi.fn().mockReturnValue({ limit })
  const collection = vi.fn().mockReturnValue({ find })
  return { db: { collection } as unknown as Db, collection, find, limit }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSendServerPurchase.mockResolvedValue({ ok: true, status: 200, body: {} })
  mockRecordAttempt.mockResolvedValue(undefined)
})

describe('replay constants', () => {
  it('preserves the route behavior bounds: 5 attempts, 7 days, batch 100', () => {
    expect(MAX_ATTEMPTS).toBe(5)
    expect(MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(BATCH_LIMIT).toBe(100)
  })
})

describe('buildEligibilityFilter', () => {
  it('gates on consent, missing sentAt, 7-day window, attempts<5 and payment/status pairs', () => {
    const cutoff = new Date('2026-06-05T00:00:00.000Z')
    expect(buildEligibilityFilter(cutoff)).toEqual({
      marketingConsent: true,
      'metaCapi.purchase.sentAt': { $exists: false },
      createdAt: { $gte: cutoff },
      $and: [
        {
          $or: [
            { 'metaCapi.purchase.attempts': { $exists: false } },
            { 'metaCapi.purchase.attempts': { $lt: 5 } },
          ],
        },
        {
          $or: [
            { paymentMethod: 'cod', status: 'received' },
            { paymentMethod: 'card', status: 'paid' },
          ],
        },
      ],
    })
  })
})

describe('runCapiReplay', () => {
  it('queries the orders collection with the eligibility filter and batch limit', async () => {
    const { db, collection, find, limit } = makeDb([])
    const now = new Date('2026-06-12T12:00:00.000Z')

    const summary = await runCapiReplay(db, { now })

    expect(collection).toHaveBeenCalledWith(ORDERS_COLLECTION)
    const expectedCutoff = new Date(now.getTime() - MAX_AGE_MS)
    expect(find).toHaveBeenCalledWith(buildEligibilityFilter(expectedCutoff))
    expect(limit).toHaveBeenCalledWith(BATCH_LIMIT)
    expect(summary).toEqual({
      ok: true,
      candidates: 0,
      sent: 0,
      failed: 0,
      cutoff: expectedCutoff.toISOString(),
    })
  })

  it('replays each order with full plumbing: confirmation URL, tracking, experiments, testEventCode', async () => {
    const order = makeOrder({
      testEventCode: 'TEST123',
      experiments: { checkoutPaymentUi: 'compact_payment_options' },
    })
    const { db } = makeDb([order])

    await runCapiReplay(db)

    expect(mockAbsoluteUrl).toHaveBeenCalledWith('/order-confirmation/AAAA1111')
    expect(mockSendServerPurchase).toHaveBeenCalledTimes(1)
    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'AAAA1111',
        shipping: order.shipping,
        clientIp: '203.0.113.42',
        clientUserAgent: 'Mozilla/5.0 Test',
        totalPrice: 200,
        contentIds: ['furniture__oslo-nightstand'],
        numItems: 2,
        eventSourceUrl: 'https://shop.example.test/order-confirmation/AAAA1111',
        tracking: order.tracking,
        customData: checkoutPaymentExperimentParams('compact_payment_options'),
        marketingConsent: true,
        testEventCode: 'TEST123',
      }),
    )
  })

  it('records every attempt and counts sent vs failed', async () => {
    const ok = { ok: true, status: 200, body: {} }
    const bad = { ok: false, status: 500, body: { error: 'graph down' } }
    mockSendServerPurchase.mockResolvedValueOnce(ok).mockResolvedValueOnce(bad)
    const { db } = makeDb([makeOrder({ orderId: 'OK111111' }), makeOrder({ orderId: 'BAD22222' })])

    const summary = await runCapiReplay(db)

    expect(summary).toMatchObject({ candidates: 2, sent: 1, failed: 1 })
    expect(mockRecordAttempt).toHaveBeenCalledTimes(2)
    expect(mockRecordAttempt).toHaveBeenNthCalledWith(1, 'OK111111', ok)
    expect(mockRecordAttempt).toHaveBeenNthCalledWith(2, 'BAD22222', bad)
  })

  it('passes the persisted order currency through to the Purchase send', async () => {
    const { db } = makeDb([makeOrder({ currency: 'EUR', totalPrice: 250 })])

    await runCapiReplay(db)

    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ totalPrice: 250, currency: 'EUR' }),
    )
  })

  it('supplies content_name and shipping cost from the order doc (recommended Purchase fields)', async () => {
    const order = makeOrder({
      items: [
        { id: 'furniture__oslo-nightstand', productName: 'Oslo Nightstand', quantity: 1, unitPrice: 100, productType: 'furniture', slug: 'oslo-nightstand', shortName: 'Oslo Nightstand' },
        { id: 'furniture__aria-console', productName: 'Aria Console', quantity: 1, unitPrice: 100, productType: 'furniture', slug: 'aria-console', shortName: 'Aria Console' },
      ],
      shippingCost: 10,
    })
    const { db } = makeDb([order])

    await runCapiReplay(db)

    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        contentName: 'Oslo Nightstand, Aria Console',
        shippingCost: 10,
      }),
    )
  })

  it('falls back to the market config currency when an old doc lacks the currency field', async () => {
    const { db } = makeDb([makeOrder({ currency: undefined })])

    await runCapiReplay(db)

    expect(mockSendServerPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'EUR' }),
    )
  })

  it('alerts the error sink with a run summary when the cron finishes with failures', async () => {
    mockSendServerPurchase
      .mockResolvedValueOnce({ ok: true, status: 200, body: {} })
      .mockResolvedValueOnce({ ok: false, status: 500, body: { error: 'graph down' } })
    const { db } = makeDb([makeOrder({ orderId: 'OK111111' }), makeOrder({ orderId: 'BAD22222' })])

    await runCapiReplay(db)

    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ candidates: 2, sent: 1, failed: 1 }),
      expect.objectContaining({ tag: 'meta_capi_replay' }),
    )
  })

  it('does not alert the error sink when every replay attempt succeeds', async () => {
    const { db } = makeDb([makeOrder({ orderId: 'OK111111' }), makeOrder({ orderId: 'OK222222' })])

    const summary = await runCapiReplay(db)

    expect(summary).toMatchObject({ sent: 2, failed: 0 })
    expect(mockCaptureError).not.toHaveBeenCalled()
  })

  it('a throwing order does not abort the batch — later orders still replay', async () => {
    const boom = new Error('mongo write lost')
    mockSendServerPurchase
      .mockResolvedValueOnce({ ok: true, status: 200, body: {} })
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce({ ok: true, status: 200, body: {} })
    const { db } = makeDb([
      makeOrder({ orderId: 'FIRST111' }),
      makeOrder({ orderId: 'THROW222' }),
      makeOrder({ orderId: 'THIRD333' }),
    ])

    const summary = await runCapiReplay(db)

    expect(mockSendServerPurchase).toHaveBeenCalledTimes(3)
    expect(summary).toMatchObject({ candidates: 3, sent: 2, failed: 1 })
    expect(mockCaptureError).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({ orderId: 'THROW222' }),
      expect.objectContaining({ tag: 'meta_capi_replay' }),
    )
  })
})
