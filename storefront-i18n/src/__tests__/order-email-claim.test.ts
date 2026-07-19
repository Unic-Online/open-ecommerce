import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindOneAndUpdate, mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOneAndUpdate: vi.fn(),
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      findOneAndUpdate: mockFindOneAndUpdate,
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
    }),
  }),
}));

vi.mock('@/lib/resend', () => ({ getResend: vi.fn() }));

import {
  claimOrderEmail,
  markOrderEmailSent,
  releaseOrderEmailClaim,
} from '@/lib/contacts';

describe('Order email claim (B2)', () => {
  beforeEach(() => {
    mockFindOneAndUpdate.mockReset();
    mockFindOne.mockReset();
    mockUpdateOne.mockReset();
  });

  describe('claimOrderEmail', () => {
    it('claims when emailSentAt is absent and no in-flight attempt exists', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X', emailSendAttemptedAt: new Date() });
      const result = await claimOrderEmail('X');
      expect(result).toEqual({ claimed: true, alreadySent: false });
    });

    it('refuses claim when filter does not match and reports alreadySent=true when emailSentAt is set', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce(null);
      mockFindOne.mockResolvedValueOnce({ emailSentAt: new Date() });
      const result = await claimOrderEmail('X');
      expect(result).toEqual({ claimed: false, alreadySent: true });
    });

    it('refuses claim and reports alreadySent=false when an in-flight attempt is still fresh', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce(null);
      mockFindOne.mockResolvedValueOnce({ emailSendAttemptedAt: new Date() });
      const result = await claimOrderEmail('X');
      expect(result).toEqual({ claimed: false, alreadySent: false });
    });

    it('filter guards: $nin terminal, emailSentAt absent, claim is absent or stale, plus expectedPaymentMethod', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce({ orderId: 'X' });
      await claimOrderEmail('X', { expectedPaymentMethod: 'card' });
      const [filter, update] = mockFindOneAndUpdate.mock.calls[0];

      const guards = (filter as { $and: Array<Record<string, unknown>> }).$and;
      const guardKeys = guards.map(g => Object.keys(g)[0]);
      expect(guardKeys).toContain('status');
      expect(guardKeys).toContain('emailSentAt');
      expect(guardKeys).toContain('$or');
      expect(guardKeys).toContain('paymentMethod');

      const orGuard = guards.find(g => '$or' in g) as { $or: Array<Record<string, unknown>> };
      expect(orGuard.$or).toHaveLength(2);

      const set = (update as { $set: Record<string, unknown> }).$set;
      expect(set.emailSendAttemptedAt).toBeInstanceOf(Date);
    });
  });

  describe('markOrderEmailSent', () => {
    it('sets emailSentAt with a once-only filter', async () => {
      mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      await markOrderEmailSent('X');
      const [filter, update] = mockUpdateOne.mock.calls[0];
      expect((filter as { emailSentAt: unknown }).emailSentAt).toEqual({ $exists: false });
      const set = (update as { $set: Record<string, unknown> }).$set;
      expect(set.emailSentAt).toBeInstanceOf(Date);
    });
  });

  describe('releaseOrderEmailClaim', () => {
    it('unsets emailSendAttemptedAt and records the failure for operator visibility', async () => {
      mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      await releaseOrderEmailClaim('X', 'resend 503');
      const [, update] = mockUpdateOne.mock.calls[0];
      const ops = update as { $unset: Record<string, unknown>; $set: Record<string, unknown> };
      expect(ops.$unset).toEqual({ emailSendAttemptedAt: '' });
      expect(ops.$set.emailSendLastError).toBe('resend 503');
      expect(ops.$set.emailSendLastAttemptAt).toBeInstanceOf(Date);
    });

    it('truncates very long error messages to 500 chars', async () => {
      mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      await releaseOrderEmailClaim('X', 'x'.repeat(2000));
      const [, update] = mockUpdateOne.mock.calls[0];
      const set = (update as { $set: { emailSendLastError: string } }).$set;
      expect(set.emailSendLastError.length).toBe(500);
    });
  });
});
