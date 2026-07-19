/**
 * Regression: upsertContact must never place `source` in BOTH `$set` (via the
 * `...data` spread) and `$setOnInsert`. MongoDB statically rejects an update
 * document that touches the same path in two operators
 * ("Updating the path 'source' would create a conflict at 'source'"), and all
 * four production call sites pass `source` — so every contact upsert threw.
 * First-touch attribution intent: `source` lives in `$setOnInsert` ONLY.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpdateOne } = vi.hoisted(() => ({
  mockUpdateOne: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: () => ({
      updateOne: mockUpdateOne,
    }),
  }),
}));

vi.mock('@/lib/resend', () => ({ getResend: vi.fn() }));

import { upsertContact } from '@/lib/contacts';

/**
 * Mimic MongoDB's static update validation: any path present in two update
 * operators makes the server reject the whole command.
 */
function mongoConflictGuard(_filter: unknown, update: Record<string, unknown>) {
  const setPaths = Object.keys((update.$set as Record<string, unknown>) ?? {});
  const onInsertPaths = Object.keys((update.$setOnInsert as Record<string, unknown>) ?? {});
  const conflict = setPaths.find((p) => onInsertPaths.includes(p));
  if (conflict) {
    return Promise.reject(
      new Error(`Updating the path '${conflict}' would create a conflict at '${conflict}'`),
    );
  }
  return Promise.resolve({ acknowledged: true });
}

describe('upsertContact — source belongs to $setOnInsert only', () => {
  beforeEach(() => {
    mockUpdateOne.mockReset();
    mockUpdateOne.mockImplementation(mongoConflictGuard);
  });

  it('keeps source out of $set while other data fields still land in $set', async () => {
    await upsertContact('Ion@Test.RO', {
      source: 'order',
      firstName: 'Ion',
      phone: '0722000000',
    });

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = mockUpdateOne.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> },
    ];

    expect(filter).toEqual({ email: 'ion@test.ro' });

    // First-touch attribution: source only on insert.
    expect(update.$setOnInsert.source).toBe('order');
    expect(update.$set).not.toHaveProperty('source');

    // The rest of the payload still updates the existing doc.
    expect(update.$set).toMatchObject({
      email: 'ion@test.ro',
      firstName: 'Ion',
      phone: '0722000000',
    });
    expect(update.$set.updatedAt).toBeInstanceOf(Date);
    expect(update.$setOnInsert.createdAt).toBeInstanceOf(Date);
  });

  it('does not throw the Mongo path-conflict error when the caller passes source (all 4 call sites do)', async () => {
    await expect(
      upsertContact('a@b.ro', { source: 'email_popup' }),
    ).resolves.toBeUndefined();
  });

  it('defaults source to "website" on insert when the caller omits it', async () => {
    await upsertContact('a@b.ro', { firstName: 'Ana' });

    const [, update] = mockUpdateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> },
    ];
    expect(update.$setOnInsert.source).toBe('website');
    expect(update.$set).not.toHaveProperty('source');
  });
});
