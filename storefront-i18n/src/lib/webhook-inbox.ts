/**
 * Tracks webhook deliveries that arrive before the local order doc has been
 * committed — closes the "webhook beats DB write" race. Revolut retries any
 * webhook we answer with a non-2xx, so for the first N retries / first M
 * minutes we ask Revolut to come back. After that we accept it as an orphan
 * (paid at the provider with no local doc) and surface it through the error
 * sink so the operator can reconcile.
 *
 * Invariants:
 *   - `providerOrderId` is the natural key — one inbox doc per Revolut order id.
 *   - `firstSeenAt` is set on insert and never updated; `lastSeenAt` is bumped each call.
 *   - `attempts` increments monotonically.
 *   - `shouldGiveUp` flips true once `attempts >= MAX_ATTEMPTS` OR age > `MAX_AGE_MS`.
 * Side effects: upserts into `webhook_inbox` (auto-pruned by TTL on `firstSeenAt`).
 * Caller contract: webhook handler decides whether to return retryable 409 or accept-and-log based on `shouldGiveUp`.
 */
import { getDb } from './mongodb';
import { captureError } from './error-sink';

const COLLECTION = 'webhook_inbox';
const MAX_ATTEMPTS = 5;
const MAX_AGE_MS = 10 * 60 * 1000; // 10 min — Revolut typically resolves create→webhook well inside this
const TTL_SECONDS = 24 * 60 * 60; // 24h — keep records for one day of debuggability, then GC

let indexEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexEnsured) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  try {
    await Promise.all([
      col.createIndex({ providerOrderId: 1 }, { unique: true }),
      col.createIndex({ firstSeenAt: 1 }, { expireAfterSeconds: TTL_SECONDS }),
    ]);
    indexEnsured = true;
  } catch (err) {
    // Surface, don't swallow: a failed TTL index means orphan inbox docs accumulate
    // forever with nobody watching. Stay degraded (don't throw) so the webhook race
    // guard still works, but leave indexEnsured=false so the next call retries.
    captureError(err, { collection: COLLECTION }, { tag: 'webhook_inbox_index' });
  }
}

export interface UnknownOrderState {
  attempts: number;
  firstSeenAt: Date;
  shouldGiveUp: boolean;
}

export async function recordUnknownOrderWebhook(providerOrderId: string): Promise<UnknownOrderState> {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const res = await db.collection(COLLECTION).findOneAndUpdate(
    { providerOrderId },
    {
      $setOnInsert: { providerOrderId, firstSeenAt: now },
      $set: { lastSeenAt: now },
      $inc: { attempts: 1 },
    },
    { upsert: true, returnDocument: 'after' },
  );
  const attempts = (res?.attempts as number | undefined) ?? 1;
  const firstSeenAt = (res?.firstSeenAt as Date | undefined) ?? now;
  const ageMs = now.getTime() - firstSeenAt.getTime();
  return {
    attempts,
    firstSeenAt,
    shouldGiveUp: attempts >= MAX_ATTEMPTS || ageMs >= MAX_AGE_MS,
  };
}

/** Clear the inbox row once the order doc materialises and the webhook is processed normally. */
export async function clearUnknownOrderWebhook(providerOrderId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ providerOrderId });
}
