/**
 * MongoDB persistence for contacts, orders, and consents + Resend audience mirror.
 *
 * Invariants:
 *   - `email` is the contact PK and is always lowercased+trimmed before any read/write.
 *   - `orders.emailSentAt` is set atomically once via `markEmailSent` filter — guarantees one confirmation email per order.
 *   - `consents` is append-only (GDPR Art. 7(1)); never updated, never deleted in normal flow.
 *   - Resend 409 ("already exists") is treated as success; any other error is logged but does not throw.
 * Side effects: writes to `contacts`, `orders`, `consents` collections; calls Resend audiences/contacts API.
 * Caller contract: routes that depend on the MongoDB write succeeding MUST `await upsertContact` — Resend sync errors are swallowed but Mongo errors bubble.
 */
import { getDb } from './mongodb';
import { getResend } from './resend';
import {
  ensureOrderIdIndex,
  generateOrderId,
  isDuplicateKeyError,
  ORDER_ID_INSERT_MAX_ATTEMPTS,
} from './orders/order-id';
import type { RevolutOrderState } from './revolut';
import type { CapiResult } from './meta-capi';
import { captureError } from './error-sink';

const COLLECTION = 'contacts';
const ORDERS_COLLECTION = 'orders';
const CONSENTS_COLLECTION = 'consents';

// Resend audience ID — will be created on first use
let audienceId: string | null = null;

/**
 * Get or create the Acme Store audience in Resend
 */
async function getAudienceId(): Promise<string | null> {
  if (audienceId) return audienceId;

  try {
    // List existing audiences
    const { data: audiences } = await getResend().audiences.list();
    const existing = audiences?.data?.find(
      (a: { id: string; name: string }) => a.name === 'Acme Store'
    );
    if (existing) {
      audienceId = existing.id;
      return audienceId;
    }

    // Create new audience
    const { data: created } = await getResend().audiences.create({ name: 'Acme Store' });
    if (created) {
      audienceId = created.id;
      return audienceId;
    }
  } catch (err) {
    console.error('Failed to get/create Resend audience:', err);
  }

  return null;
}

/**
 * Upsert a contact in MongoDB (keyed by email) and add to Resend contacts.
 *
 * @param email - Email address (used as the unique key)
 * @param data  - Additional data to merge into the contact document
 */
export async function upsertContact(
  email: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  // 1. Upsert in MongoDB. Persistence failures must bubble to the caller so
  // routes can decide whether contact capture/order handling may proceed.
  const db = await getDb();
  const collection = db.collection(COLLECTION);

  // Invariant: `source` is first-touch attribution — written once on insert,
  // never overwritten. It must stay OUT of the `$set` spread: MongoDB
  // statically rejects an update that touches the same path in both `$set`
  // and `$setOnInsert` ("Updating the path 'source' would create a conflict"),
  // which would fail the entire contact write.
  const { source, ...updateData } = data;
  await collection.updateOne(
    { email: normalizedEmail },
    {
      $set: {
        email: normalizedEmail,
        updatedAt: new Date(),
        ...updateData,
      },
      $setOnInsert: {
        createdAt: new Date(),
        source: source || 'website',
      },
    },
    { upsert: true }
  );

  // 2. Add to Resend contacts (subscribed by default)
  try {
    const audId = await getAudienceId();
    if (audId) {
      await getResend().contacts.create({
        audienceId: audId,
        email: normalizedEmail,
        firstName: (data.firstName as string) || undefined,
        lastName: (data.lastName as string) || undefined,
        unsubscribed: false,
      });
    }
  } catch (err) {
    // Resend returns 409 if contact exists — that's fine
    const errorMsg = String(err);
    if (!errorMsg.includes('409') && !errorMsg.includes('already exists')) {
      console.error('Resend contact create failed:', err);
    }
  }
}

/**
 * Save a completed order to MongoDB, linked to the contact.
 *
 * `orderData` is intentionally a loose record (Mongo collection is schemaless),
 * but the i18n-aware fields below are recognized and persisted alongside the
 * existing shape:
 *   - `market`   ('ro' | 'french')      — commercial market, drives currency/legal
 *   - `locale`   ('ro' | 'fr')          — UI language at order time
 *   - `currency` ('RON' | 'EUR')        — duplicated from market for query-friendliness
 *   - `domain`   (request host string)  — captured for cross-domain debugging
 * Adding these as optional fields is non-breaking — older docs simply lack them
 * and downstream readers fall back to the cart's market or DEFAULT_MARKET.
 *
 * Returns the orderId that actually landed: ids are 4 random bytes under a
 * unique index, so on a duplicate-key collision (Mongo 11000) the id is
 * regenerated and the insert retried (bounded). Callers MUST use the returned
 * id, not the one they passed in.
 */
export async function saveOrder(
  orderId: string,
  email: string,
  orderData: Record<string, unknown>
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();

  await ensureOrderIdIndex();

  // Save order in 'orders' collection. Regenerate-on-duplicate: the unique
  // index turns a random-id birthday collision into an 11000 instead of two
  // customers sharing a confirmation page / admin doc.
  let finalOrderId = orderId;
  for (let attempt = 1; ; attempt++) {
    try {
      await db.collection(ORDERS_COLLECTION).insertOne({
        orderId: finalOrderId,
        email: normalizedEmail,
        ...orderData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      break;
    } catch (err) {
      if (!isDuplicateKeyError(err) || attempt >= ORDER_ID_INSERT_MAX_ATTEMPTS) throw err;
      finalOrderId = generateOrderId();
    }
  }

  // Update the contact with last order info
  await db.collection(COLLECTION).updateOne(
    { email: normalizedEmail },
    {
      $set: {
        lastOrderId: finalOrderId,
        lastOrderAt: new Date(),
        updatedAt: new Date(),
        ...(orderData.shipping as Record<string, unknown> || {}),
      },
      $inc: { orderCount: 1 },
      $setOnInsert: {
        createdAt: new Date(),
        source: 'order',
      },
    },
    { upsert: true }
  );

  return finalOrderId;
}

/**
 * Non-terminal statuses for the upsert-by-cartId flow. A doc in any of these
 * states is considered "still in flight" and may be updated in place when the
 * customer switches payment method or re-prepares a card session.
 *
 * - `received` (ramburs) is included so a customer who placed ramburs and then
 *   switched back to card lands on the same order doc — but #14 does not
 *   require that direction; the common case is card→ramburs.
 */
const NON_TERMINAL_ORDER_STATUSES = ['pending_payment', 'received'] as const;

/**
 * Find the most recent non-terminal order for a given cart + email. Used by
 * the order-creation routes to detect a phantom doc the customer left behind
 * on a previous payment-method choice (e.g. a card prepare followed by
 * ramburs).
 *
 * The email match is required (not just cartId) because `cartId` lives in a
 * non-httpOnly cookie with a 90-day lifetime, so a shared browser session
 * (family device, public terminal) can present a stale cartId for a
 * different customer. Without the email match we would silently mutate
 * person A's pending order with person B's shipping + email on the next
 * checkout. Treating an email mismatch as "no active order" makes the
 * caller fall back to a fresh insert.
 */
export async function findActiveOrderByCartId(cartId: string, email: string) {
  if (!cartId) return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const db = await getDb();
  return db.collection(ORDERS_COLLECTION).findOne(
    {
      cartId,
      email: normalizedEmail,
      status: { $in: NON_TERMINAL_ORDER_STATUSES as unknown as string[] },
    },
    { sort: { createdAt: -1 } },
  );
}

export interface UpsertOrderByCartIdArgs {
  cartId?: string;
  fallbackOrderId: string;
  email: string;
  orderData: Record<string, unknown>;
}

export interface UpsertOrderByCartIdResult {
  orderId: string;
  reused: boolean;
  // Present only when reused === true: the doc as it was BEFORE the update.
  // Routes use this to fire-and-forget cancellation of a previously created
  // Revolut session when the customer switches payment method.
  previous?: Record<string, unknown>;
}

/**
 * Idempotent order persistence keyed by cartId. The customer's cart cookie
 * lives for 90 days, so a single browser session that goes:
 *   prepare card → switch to ramburs → confirm
 * results in exactly one order doc, not two.
 *
 * Behavior:
 *   - `cartId` missing → plain insert via `saveOrder`. The fallback path for
 *     pre-cookie visitors and sources (admin tooling) that don't have a cart.
 *   - Existing non-terminal doc with same cartId → atomic in-place update.
 *     Preserves `orderId` and `createdAt`; replaces shipping/items/totals/
 *     paymentMethod/status/payment etc. so the doc reflects the customer's
 *     latest choice. Returns the EXISTING orderId (not the fallback) so the
 *     caller can route the customer to `/confirmare/[existingOrderId]`.
 *   - No existing doc → insert with `fallbackOrderId`.
 *
 * The contact `lastOrderId` and audience sync are touched only on insert. On
 * an in-place update the contact already points at this order doc — touching
 * `orderCount` again would inflate the counter on every payment-method flip.
 */
export async function upsertOrderByCartId(
  args: UpsertOrderByCartIdArgs,
): Promise<UpsertOrderByCartIdResult> {
  const normalizedEmail = args.email.trim().toLowerCase();
  const db = await getDb();
  const orders = db.collection(ORDERS_COLLECTION);

  // Match on cartId + email. Same rationale as findActiveOrderByCartId:
  // cartId alone is not safe to key on because the cookie can outlive the
  // signed-in customer and travel between people on a shared device. An
  // email mismatch must fall through to a fresh insert, never silently
  // mutate the other customer's pending order.
  const existing = args.cartId
    ? await orders.findOne(
        {
          cartId: args.cartId,
          email: normalizedEmail,
          status: { $in: NON_TERMINAL_ORDER_STATUSES as unknown as string[] },
        },
        { sort: { createdAt: -1 } },
      )
    : null;

  if (existing && typeof existing.orderId === 'string') {
    const reusedOrderId = existing.orderId;
    // Atomic update on the same _id. The filter re-asserts cartId + email +
    // non-terminal so a webhook racing with this call (flipping the doc to
    // `paid`) leaves the doc alone — `matched: false` would be the result
    // and the route proceeds with the fresh fallback insert below.
    const set: Record<string, unknown> = {
      email: normalizedEmail,
      ...args.orderData,
      updatedAt: new Date(),
    };
    const matched = await orders.findOneAndUpdate(
      {
        _id: existing._id,
        cartId: args.cartId,
        email: normalizedEmail,
        status: { $in: NON_TERMINAL_ORDER_STATUSES as unknown as string[] },
      },
      { $set: set },
      { returnDocument: 'after' },
    );
    if (matched) {
      return {
        orderId: reusedOrderId,
        reused: true,
        previous: existing as Record<string, unknown>,
      };
    }
    // Race lost (doc moved to terminal between findOne and findOneAndUpdate).
    // Fall through to fresh insert with the fallback orderId.
  }

  // saveOrder may regenerate the id on a unique-index collision — propagate
  // the id that actually landed so the route confirms the real doc.
  const insertedOrderId = await saveOrder(args.fallbackOrderId, normalizedEmail, args.orderData);
  return { orderId: insertedOrderId, reused: false };
}

export interface PaymentUpdate {
  providerOrderId?: string;
  providerPublicId?: string;
  providerCheckoutUrl?: string;
  state?: RevolutOrderState;
  paidAt?: Date | null;
  lastWebhookEvent?: string;
  // When rotating providerOrderId (tab-race / retry on create-order), record
  // every prior Revolut session id so the caller can cancel ALL of them
  // instead of only the most recent. Replaces the field on each set.
  previousProviderOrderIds?: string[];
}

export type OrderPaymentStatus =
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'failed'
  | 'received'
  | 'refunded';

/**
 * Update payment fields and order status atomically.
 *
 * Filter invariants:
 *   - Always refuses to overwrite an admin terminal state. The filter includes
 *     `status: { $nin: ['cancelled','refunded'] }` regardless of caller, so a
 *     stale Revolut webhook can't roll back a manual cancellation/refund.
 *     Returns `{ matched: false }` instead of touching the doc.
 *   - When `options.expectedFromStatus` is provided, the filter additionally
 *     requires `status: { $in: expectedFromStatus }` — used by callers that
 *     want optimistic concurrency on a specific transition.
 *
 * Returns whether the filter matched and (when `markEmailSent` was requested)
 * whether the email was already sent on a prior call.
 */
export async function updateOrderPayment(
  orderId: string,
  status: OrderPaymentStatus,
  payment: PaymentUpdate,
  options: {
    markEmailSent?: boolean;
    expectedFromStatus?: OrderPaymentStatus[];
    // Webhook callers pass 'card' so a late Revolut callback can't flip a doc
    // the customer has converted to ramburs. The doc's `paymentMethod` is set
    // at creation and again on every upsert-by-cartId update, so this is the
    // canonical "what is the customer paying with right now" gate.
    expectedPaymentMethod?: 'card' | 'ramburs';
  } = {}
): Promise<{ emailAlreadySent: boolean; matched: boolean }> {
  const db = await getDb();
  const set: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
    'payment.updatedAt': new Date(),
  };
  if (payment.providerOrderId !== undefined) set['payment.providerOrderId'] = payment.providerOrderId;
  if (payment.providerPublicId !== undefined) set['payment.providerPublicId'] = payment.providerPublicId;
  if (payment.providerCheckoutUrl !== undefined) set['payment.providerCheckoutUrl'] = payment.providerCheckoutUrl;
  if (payment.state !== undefined) set['payment.state'] = payment.state;
  if (payment.lastWebhookEvent !== undefined) set['payment.lastWebhookEvent'] = payment.lastWebhookEvent;
  if (payment.paidAt !== undefined) set['payment.paidAt'] = payment.paidAt;
  if (payment.previousProviderOrderIds !== undefined) set['payment.previousProviderOrderIds'] = payment.previousProviderOrderIds;

  // Refuse to overwrite an admin terminal state regardless of caller. A
  // stale webhook arriving after the operator hits Cancel/Refund must not
  // silently roll the order back to `paid`.
  const statusGuards: Record<string, unknown>[] = [
    { status: { $nin: ['cancelled', 'refunded'] } },
  ];
  if (options.expectedFromStatus && options.expectedFromStatus.length > 0) {
    statusGuards.push({ status: { $in: options.expectedFromStatus } });
  }
  if (options.expectedPaymentMethod) {
    statusGuards.push({ paymentMethod: options.expectedPaymentMethod });
  }

  const filter: Record<string, unknown> = { orderId, $and: statusGuards };
  if (options.markEmailSent) {
    // Atomic: only set emailSentAt if it doesn't exist yet — prevents duplicate sends.
    filter.emailSentAt = { $exists: false };
    set.emailSentAt = new Date();
  }

  const result = await db.collection(ORDERS_COLLECTION).findOneAndUpdate(
    filter,
    { $set: set },
    { returnDocument: 'after' }
  );

  // If markEmailSent was requested but the filter didn't match, the email was already sent.
  return {
    emailAlreadySent: options.markEmailSent === true && !result,
    matched: result !== null,
  };
}

/**
 * Default time after which an in-flight email claim is considered stale and
 * may be re-acquired. 60 s comfortably covers a Revolut → Resend round-trip;
 * Revolut's retry cadence on a non-2xx is ~minutes, so a real second delivery
 * will always see either `emailSentAt` (claim succeeded + send succeeded) or
 * a stale claim (claim succeeded + send failed, route returned non-2xx).
 */
const EMAIL_CLAIM_STALE_MS = 60_000;

/**
 * Atomic email-send claim. Returns `{ claimed: true }` for the worker that
 * gets the once-only right to send the confirmation email; subsequent callers
 * see either `alreadySent: true` (a previous claim succeeded and Resend acked)
 * or `claimed: false` with `alreadySent: false` (another worker is mid-send
 * and we shouldn't double-send).
 *
 * Decouples idempotency from delivery success: a transient Resend failure no
 * longer burns the once-only token — see `releaseEmailClaim`.
 */
export async function claimOrderEmail(
  orderId: string,
  options: { expectedPaymentMethod?: 'card' | 'ramburs'; staleAfterMs?: number } = {},
): Promise<{ claimed: boolean; alreadySent: boolean }> {
  const db = await getDb();
  const orders = db.collection(ORDERS_COLLECTION);
  const staleAfterMs = options.staleAfterMs ?? EMAIL_CLAIM_STALE_MS;
  const cutoff = new Date(Date.now() - staleAfterMs);
  const guards: Record<string, unknown>[] = [
    { status: { $nin: ['cancelled', 'refunded'] } },
    { emailSentAt: { $exists: false } },
    {
      $or: [
        { emailSendAttemptedAt: { $exists: false } },
        { emailSendAttemptedAt: { $lt: cutoff } },
      ],
    },
  ];
  if (options.expectedPaymentMethod) {
    guards.push({ paymentMethod: options.expectedPaymentMethod });
  }
  const claimed = await orders.findOneAndUpdate(
    { orderId, $and: guards },
    { $set: { emailSendAttemptedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (claimed) return { claimed: true, alreadySent: false };

  // Disambiguate: already sent vs. in-flight by another worker.
  const doc = await orders.findOne(
    { orderId },
    { projection: { emailSentAt: 1, emailSendAttemptedAt: 1 } },
  );
  return { claimed: false, alreadySent: !!doc?.emailSentAt };
}

/** Mark the email as successfully delivered. No-op if it was already marked. */
export async function markOrderEmailSent(orderId: string): Promise<void> {
  const db = await getDb();
  await db.collection(ORDERS_COLLECTION).updateOne(
    { orderId, emailSentAt: { $exists: false } },
    { $set: { emailSentAt: new Date(), updatedAt: new Date() } },
  );
}

/**
 * Release a claim after a Resend send failure so the next delivery can re-claim.
 * Records the failure reason for operator visibility (admin order detail page).
 */
export async function releaseOrderEmailClaim(orderId: string, errorMessage: string): Promise<void> {
  const db = await getDb();
  await db.collection(ORDERS_COLLECTION).updateOne(
    { orderId },
    {
      $unset: { emailSendAttemptedAt: '' },
      $set: {
        emailSendLastError: errorMessage.slice(0, 500),
        emailSendLastAttemptAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
}

export async function findOrderById(orderId: string) {
  const db = await getDb();
  return db.collection(ORDERS_COLLECTION).findOne({ orderId });
}

function capiResultErrorCode(result: CapiResult): string {
  const body = (result.body && typeof result.body === 'object'
    ? (result.body as Record<string, unknown>)
    : {}) as { error?: unknown };
  if (typeof body.error === 'string') return body.error;
  return result.status > 0 ? `http_${result.status}` : 'unknown';
}

/**
 * Persist the outcome of a Meta CAPI Purchase send so the daily replay cron
 * can find unsent orders and retry. Consent-denied is a permanent, expected
 * non-send — skipped to avoid polluting docs with a non-actionable lastError.
 *
 * Success: clears lastError, sets sentAt — order becomes ineligible for replay.
 * Failure: increments attempts, records the error code — picked up by the cron
 * until attempts hit MAX_ATTEMPTS or the 7-day attribution window elapses.
 */
export async function recordCapiPurchaseAttempt(
  orderId: string,
  result: CapiResult,
): Promise<void> {
  const errorCode = result.ok ? null : capiResultErrorCode(result);
  if (errorCode === 'consent_denied_or_missing' || errorCode === 'disabled') return;

  const db = await getDb();
  const now = new Date();

  if (result.ok) {
    await db.collection(ORDERS_COLLECTION).updateOne(
      { orderId },
      {
        $set: {
          'metaCapi.purchase.sentAt': now,
          'metaCapi.purchase.lastAttemptAt': now,
          updatedAt: now,
        },
        $unset: { 'metaCapi.purchase.lastError': '' },
        $inc: { 'metaCapi.purchase.attempts': 1 },
      },
    );
    return;
  }

  await db.collection(ORDERS_COLLECTION).updateOne(
    { orderId },
    {
      $set: {
        'metaCapi.purchase.lastError': (errorCode ?? 'unknown').slice(0, 200),
        'metaCapi.purchase.lastAttemptAt': now,
        updatedAt: now,
      },
      $inc: { 'metaCapi.purchase.attempts': 1 },
    },
  );

  captureError(
    new Error(`Meta CAPI Purchase failed: ${errorCode}`),
    { orderId, httpStatus: result.status },
    { tag: 'meta_capi_purchase_failed', level: 'warning' },
  );
}

export async function findOrderByProviderOrderId(providerOrderId: string) {
  const db = await getDb();
  return db.collection(ORDERS_COLLECTION).findOne({ 'payment.providerOrderId': providerOrderId });
}

export async function findOrderByProviderPublicId(providerPublicId: string) {
  const db = await getDb();
  return db.collection(ORDERS_COLLECTION).findOne({ 'payment.providerPublicId': providerPublicId });
}

export interface ConsentRecord {
  version: string;
  analytics: boolean;
  marketing: boolean;
  source: string;
  givenAt: Date;
  clientIp?: string;
  clientUserAgent?: string;
  email?: string;
}

/**
 * Append-only audit log of every consent action a user takes. Required by
 * GDPR Art. 7(1) — proof of consent ("the controller shall be able to
 * demonstrate that the data subject has consented"). One document per
 * banner interaction; never updated.
 */
export async function saveConsent(record: ConsentRecord): Promise<void> {
  const db = await getDb();
  await db.collection(CONSENTS_COLLECTION).insertOne({
    ...record,
    createdAt: new Date(),
  });
}
