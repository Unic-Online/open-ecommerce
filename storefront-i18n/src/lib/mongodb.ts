/**
 * MongoDB client singleton.
 *
 * Invariants:
 *   - One MongoClient per process (dev: across HMR via globalThis; prod: module-local cache).
 *   - Connection is lazy: nothing connects until the first `getDb()` call.
 *   - DB name from MONGODB_DB_NAME (default `storefront`); Playwright e2e overrides to `storefront-e2e`.
 * Side effects: connects to MONGODB_URI on first use; throws synchronously if URI is missing.
 * Caller contract: never new up your own MongoClient — always go through `getDb()`.
 */
import { MongoClient, type Db } from 'mongodb';
import { storage } from '@/site.config';
import { serverEnv } from '@/env';

// Default DB name from site config. Override with MONGODB_DB_NAME — useful for
// e2e tests that point at the same cluster but write to an isolated database.
const DB_NAME = serverEnv.MONGODB_DB_NAME || storage.mongoDbName;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let cachedPromise: Promise<MongoClient> | undefined;

function getClientPromise(): Promise<MongoClient> {
  const uri = serverEnv.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in environment');

  // Dev: reuse the client across HMR. Prod: cache module-locally.
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }
  if (!cachedPromise) {
    cachedPromise = new MongoClient(uri).connect();
  }
  return cachedPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

/**
 * True when a MongoDB connection is configured. Read paths that can degrade
 * gracefully (e.g. product-page reviews on a zero-env build) check this
 * instead of letting `getDb()` throw.
 */
export function isDbConfigured(): boolean {
  return Boolean(serverEnv.MONGODB_URI);
}
