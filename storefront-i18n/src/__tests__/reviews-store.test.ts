import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { mongoMock } from './helpers/mongodb.mock';

const { mockIsDryRun, mockGetReviewsByLocale } = vi.hoisted(() => ({
  mockIsDryRun: vi.fn(() => false),
  mockGetReviewsByLocale: vi.fn((reviewsKey: string, locale: string) => {
    if (reviewsKey === 'oslo-nightstand' && locale === 'ro') {
      return [
        {
          id: 'static-1',
          name: 'Static Reviewer',
          location: '',
          rating: 5,
          title: 'Foarte bun',
          text: 'Recenzie statica curata.',
          date: '2026-01-01T00:00:00.000Z',
          product: 'oslo-nightstand',
        },
      ];
    }
    return [];
  }),
}));

vi.mock('@/lib/mongodb', () => mongoMock.module());
vi.mock('@/plugins/abandoned-cart/config', () => ({ isAbandonedCartDryRun: mockIsDryRun }));
vi.mock('@/data/reviews-registry', () => ({ getReviewsByLocale: mockGetReviewsByLocale }));

import {
  REVIEWS_COLLECTION,
  countRecentReviewsByIp,
  decideReview,
  getApprovedReviews,
  getMergedReviews,
  insertPendingReview,
  listReviews,
} from '@/lib/reviews-store';
import { isDbConfigured } from '@/lib/mongodb';

const reviews = () => mongoMock.collection(REVIEWS_COLLECTION);

beforeEach(() => {
  mongoMock.reset();
  mockIsDryRun.mockReturnValue(false);
  mockGetReviewsByLocale.mockClear();
});

describe('insertPendingReview', () => {
  const baseInput = {
    slug: 'oslo-nightstand',
    name: 'Ion Popescu',
    rating: 5 as const,
    text: 'Produs excelent, recomand cu incredere.',
    locale: 'ro' as const,
    verifiedPurchase: false,
  };

  it('inserts as status pending with a fresh createdAt', async () => {
    reviews().insertOne.mockResolvedValueOnce({ acknowledged: true, insertedId: new ObjectId() });
    const result = await insertPendingReview(baseInput);
    expect(result.ok).toBe(true);
    const [doc] = reviews().insertOne.mock.calls[0];
    expect(doc.status).toBe('pending');
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.decidedAt).toBeUndefined();
  });

  it('returns duplicate on a Mongo 11000 error (unique partial index on orderId+slug)', async () => {
    reviews().insertOne.mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000 }));
    const result = await insertPendingReview({
      ...baseInput,
      verifiedPurchase: true,
      orderId: 'ABCD1234',
    });
    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rethrows non-duplicate errors', async () => {
    reviews().insertOne.mockRejectedValueOnce(new Error('mongo write failed'));
    await expect(insertPendingReview(baseInput)).rejects.toThrow('mongo write failed');
  });

  it('short-circuits on dry-run without touching the DB', async () => {
    mockIsDryRun.mockReturnValueOnce(true);
    const result = await insertPendingReview(baseInput);
    expect(result).toEqual({ ok: false, reason: 'dry-run' });
    expect(reviews().insertOne).not.toHaveBeenCalled();
  });
});

describe('countRecentReviewsByIp', () => {
  it('counts within the rolling window, keyed by clientIp', async () => {
    reviews().countDocuments.mockResolvedValueOnce(3);
    const count = await countRecentReviewsByIp('203.0.113.5');
    expect(count).toBe(3);
    const [filter] = reviews().countDocuments.mock.calls[0];
    expect(filter).toMatchObject({ clientIp: '203.0.113.5' });
    expect((filter as { createdAt: { $gte: Date } }).createdAt.$gte).toBeInstanceOf(Date);
  });
});

describe('listReviews', () => {
  it('filters by status and paginates via skip/limit', async () => {
    reviews().cursor.toArray.mockResolvedValueOnce([]);
    reviews().countDocuments.mockResolvedValueOnce(0);
    await listReviews({ status: 'pending', skip: 25, limit: 10 });
    expect(reviews().find).toHaveBeenCalledWith({ status: 'pending' });
    expect(reviews().cursor.skip).toHaveBeenCalledWith(25);
    expect(reviews().cursor.limit).toHaveBeenCalledWith(10);
  });

  it('omits the status filter entirely for "all"', async () => {
    reviews().cursor.toArray.mockResolvedValueOnce([]);
    reviews().countDocuments.mockResolvedValueOnce(0);
    await listReviews({ status: 'all' });
    expect(reviews().find).toHaveBeenCalledWith({});
  });
});

describe('decideReview', () => {
  it('approves a pending review atomically (filter requires status: pending)', async () => {
    const id = new ObjectId();
    reviews().findOneAndUpdate.mockResolvedValueOnce({ _id: id, status: 'approved' });
    const result = await decideReview(id.toHexString(), 'approved');
    expect(result).toMatchObject({ ok: true });
    const [filter, update] = reviews().findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ status: 'pending' });
    expect((update as { $set: Record<string, unknown> }).$set).toMatchObject({ status: 'approved' });
  });

  it('returns already-decided when the pending filter misses but the doc exists', async () => {
    const id = new ObjectId();
    reviews().findOneAndUpdate.mockResolvedValueOnce(null);
    reviews().findOne.mockResolvedValueOnce({ _id: id, status: 'approved' });
    const result = await decideReview(id.toHexString(), 'declined');
    expect(result).toEqual({ ok: false, reason: 'already-decided' });
  });

  it('returns not-found when no doc exists at all', async () => {
    const id = new ObjectId();
    reviews().findOneAndUpdate.mockResolvedValueOnce(null);
    reviews().findOne.mockResolvedValueOnce(null);
    const result = await decideReview(id.toHexString(), 'approved');
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('returns not-found for a malformed id rather than throwing', async () => {
    const result = await decideReview('not-a-valid-object-id', 'approved');
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('short-circuits on dry-run without touching the DB', async () => {
    mockIsDryRun.mockReturnValueOnce(true);
    const result = await decideReview(new ObjectId().toHexString(), 'approved');
    expect(result).toEqual({ ok: false, reason: 'dry-run' });
    expect(reviews().findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('getApprovedReviews', () => {
  it('maps approved docs to the display Review shape, falling back to a locale title', async () => {
    const id = new ObjectId();
    reviews().cursor.toArray.mockResolvedValueOnce([
      {
        _id: id,
        slug: 'oslo-nightstand',
        name: 'Maria',
        rating: 5,
        text: 'Super produs.',
        locale: 'ro',
        status: 'approved',
        verifiedPurchase: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const result = await getApprovedReviews('oslo-nightstand', 'ro');
    expect(result).toEqual([
      {
        id: id.toHexString(),
        name: 'Maria',
        location: '',
        rating: 5,
        title: 'Recenzie',
        text: 'Super produs.',
        date: '2026-01-01T00:00:00.000Z',
        product: 'oslo-nightstand',
        verifiedPurchase: true,
        helpfulCount: 0,
        topics: [],
      },
    ]);
    expect(reviews().find).toHaveBeenCalledWith({
      slug: 'oslo-nightstand',
      locale: 'ro',
      status: 'approved',
    });
  });

  it('uses the submitted title when present, instead of the fallback', async () => {
    reviews().cursor.toArray.mockResolvedValueOnce([
      {
        _id: new ObjectId(),
        slug: 'oslo-nightstand',
        name: 'Maria',
        rating: 4,
        title: 'Recomand cu incredere',
        text: 'Bun.',
        locale: 'en',
        status: 'approved',
        verifiedPurchase: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const [result] = await getApprovedReviews('oslo-nightstand', 'en');
    expect(result.title).toBe('Recomand cu incredere');
  });

  it('returns [] without touching the DB when Mongo is not configured (zero-env build)', async () => {
    vi.mocked(isDbConfigured).mockReturnValueOnce(false);
    const result = await getApprovedReviews('oslo-nightstand', 'en');
    expect(result).toEqual([]);
    expect(reviews().find).not.toHaveBeenCalled();
  });
});

describe('getMergedReviews', () => {
  it('puts DB-approved reviews first, then the static corpus looked up by reviewsKey', async () => {
    reviews().cursor.toArray.mockResolvedValueOnce([]);
    const result = await getMergedReviews('oslo-nightstand', 'oslo-nightstand', 'ro');
    expect(mockGetReviewsByLocale).toHaveBeenCalledWith('oslo-nightstand', 'ro');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('static-1');
  });

  it('skips the static lookup when reviewsKey is absent, but always attempts DB reviews', async () => {
    reviews().cursor.toArray.mockResolvedValueOnce([]);
    const result = await getMergedReviews('some-slug', undefined, 'ro');
    expect(mockGetReviewsByLocale).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
