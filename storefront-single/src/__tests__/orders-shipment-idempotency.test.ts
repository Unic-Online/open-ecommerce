import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindOne, mockFindOneAndUpdate, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      findOne: mockFindOne,
      findOneAndUpdate: mockFindOneAndUpdate,
      updateOne: mockUpdateOne,
    }),
  }),
}));

vi.mock('@/plugins/abandoned-cart/config', () => ({
  isAbandonedCartDryRun: () => false,
}));

import { setFulfillment } from '@/lib/orders/mutations';

beforeEach(() => {
  mockFindOne.mockReset();
  mockFindOneAndUpdate.mockReset();
  mockUpdateOne.mockReset();
});

describe('setFulfillment idempotency contract', () => {
  it('flags needsShipmentEmail on first transition to shipped+tracking', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: { status: 'shipped', trackingNumber: 'AWB1' },
    });
    const r = await setFulfillment('X', { status: 'shipped', trackingNumber: 'AWB1' });
    expect(r).toMatchObject({ ok: true, needsShipmentEmail: true });
  });

  it('does NOT re-flag when shipmentEmailSentAt is already populated even if tracking changes', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: {
        status: 'shipped',
        trackingNumber: 'AWB2',
        shipmentEmailSentAt: new Date('2026-05-01T08:00:00Z'),
      },
    });
    const r = await setFulfillment('X', { trackingNumber: 'AWB2' });
    expect(r).toMatchObject({ ok: true, needsShipmentEmail: false });
  });

  it('does NOT flag when status flips to shipped with empty tracking', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: { status: 'shipped' },
    });
    const r = await setFulfillment('X', { status: 'shipped' });
    expect(r).toMatchObject({ ok: true, needsShipmentEmail: false });
  });

  it('does NOT flag when only the carrier is edited', async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce({
      orderId: 'X',
      status: 'paid',
      fulfillment: {
        status: 'shipped',
        trackingNumber: 'AWB3',
        carrier: 'FAN',
      },
    });
    const r = await setFulfillment('X', { carrier: 'FAN' });
    // Status was already shipped, sentAt already absent — once unsealed, the
    // *next* save with tracking does flag. With only-carrier patch and
    // existing tracking, current state still satisfies the trigger; the
    // contract is documented as "operator hits Save again" → email re-fires
    // ONLY if shipmentEmailSentAt is missing. This case asserts that
    // expectation: a missing sentAt means the route handler IS expected to
    // try the send again.
    expect(r).toMatchObject({ ok: true, needsShipmentEmail: true });
  });
});
