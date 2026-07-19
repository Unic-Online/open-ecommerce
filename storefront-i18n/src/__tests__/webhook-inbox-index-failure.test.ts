import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateIndex, mockFindOneAndUpdate, mockCaptureError } = vi.hoisted(() => ({
  mockCreateIndex: vi.fn(),
  mockFindOneAndUpdate: vi.fn().mockResolvedValue({ providerOrderId: 'ord_1', firstSeenAt: new Date(), attempts: 1 }),
  mockCaptureError: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      createIndex: mockCreateIndex,
      findOneAndUpdate: mockFindOneAndUpdate,
    }),
  }),
}));

vi.mock('@/lib/error-sink', () => ({
  captureError: mockCaptureError,
}));

import { recordUnknownOrderWebhook } from '@/lib/webhook-inbox';

describe('webhook-inbox index creation failure surfacing', () => {
  beforeEach(() => {
    mockCreateIndex.mockReset();
    mockCaptureError.mockReset();
    mockFindOneAndUpdate.mockClear();
  });

  it('surfaces index-creation failure to the error sink instead of swallowing it', async () => {
    mockCreateIndex.mockRejectedValue(new Error('not authorized to create index'));

    // Must not throw — the inbox is a safety net and should degrade gracefully.
    await expect(recordUnknownOrderWebhook('ord_1')).resolves.toBeTruthy();

    // The issue: a swallowed `.catch(() => {})` means nobody is ever told the
    // TTL/unique index failed, so orphan records accumulate silently.
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    const [err, , opts] = mockCaptureError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(opts).toMatchObject({ tag: 'webhook_inbox_index' });
  });
});
