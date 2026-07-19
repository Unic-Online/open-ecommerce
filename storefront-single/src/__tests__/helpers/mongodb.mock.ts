/**
 * Shared MongoDB mock for unit tests.
 *
 * Replaces the per-file hand-rolled `vi.mock('@/lib/mongodb', ...)` blocks.
 * One `MongoMock` instance is created per test FILE (vitest isolates module
 * registries between files), and `clearMocks: true` in vitest.config.ts wipes
 * call history between tests automatically.
 *
 * Usage:
 *   import { mongoMock } from './helpers/mongodb.mock';
 *   vi.mock('@/lib/mongodb', () => mongoMock.module());
 *
 *   const orders = mongoMock.collection('orders');
 *   orders.findOne.mockResolvedValueOnce(buildOrder());
 *   // route under test calls getDb() → db.collection('orders') → same object
 *
 * Note: vi.mock factories run lazily (on first import of the mocked module),
 * AFTER this helper module is evaluated — referencing `mongoMock` inside the
 * factory is safe as long as the helper import precedes the import of the
 * module under test (default for top-of-file imports).
 */
import { vi, type Mock } from 'vitest';

export interface MockCursor {
  sort: Mock;
  limit: Mock;
  skip: Mock;
  project: Mock;
  /** Resolve the documents a `find()` chain returns: `cursor.toArray.mockResolvedValueOnce([...])`. */
  toArray: Mock;
}

export interface MockCollection {
  findOne: Mock;
  /** Returns `cursor` (self-chaining). Configure results via `cursor.toArray`. */
  find: Mock;
  cursor: MockCursor;
  findOneAndUpdate: Mock;
  insertOne: Mock;
  updateOne: Mock;
  updateMany: Mock;
  deleteOne: Mock;
  deleteMany: Mock;
  countDocuments: Mock;
  createIndex: Mock;
  aggregate: Mock;
}

export function createMockCollection(): MockCollection {
  const cursor: MockCursor = {
    sort: vi.fn(),
    limit: vi.fn(),
    skip: vi.fn(),
    project: vi.fn(),
    toArray: vi.fn(async () => []),
  };
  // Self-chaining: col.find(...).sort(...).limit(n).toArray()
  cursor.sort.mockReturnValue(cursor);
  cursor.limit.mockReturnValue(cursor);
  cursor.skip.mockReturnValue(cursor);
  cursor.project.mockReturnValue(cursor);

  return {
    findOne: vi.fn(async () => null),
    find: vi.fn(() => cursor),
    cursor,
    findOneAndUpdate: vi.fn(async () => null),
    insertOne: vi.fn(async () => ({ acknowledged: true, insertedId: 'mock-id' })),
    updateOne: vi.fn(async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 })),
    updateMany: vi.fn(async () => ({ acknowledged: true, matchedCount: 0, modifiedCount: 0 })),
    deleteOne: vi.fn(async () => ({ acknowledged: true, deletedCount: 1 })),
    deleteMany: vi.fn(async () => ({ acknowledged: true, deletedCount: 0 })),
    countDocuments: vi.fn(async () => 0),
    createIndex: vi.fn(async () => 'mock_index'),
    aggregate: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
  };
}

class MongoMock {
  private collections = new Map<string, MockCollection>();

  /** Get (lazily creating) the named collection's mock — same instance the code under test receives. */
  collection(name: string): MockCollection {
    let col = this.collections.get(name);
    if (!col) {
      col = createMockCollection();
      this.collections.set(name, col);
    }
    return col;
  }

  /** The `db` object `getDb()` resolves to. */
  db() {
    return {
      collection: (name: string) => this.collection(name),
    };
  }

  /** Module-shape factory for `vi.mock('@/lib/mongodb', () => mongoMock.module())`. */
  module() {
    return {
      getDb: vi.fn(async () => this.db()),
      isDbConfigured: vi.fn(() => true),
      default: Promise.resolve({}),
    };
  }

  /** Drop all collection mocks (fresh implementations, not just history). */
  reset() {
    this.collections.clear();
  }
}

export const mongoMock = new MongoMock();
