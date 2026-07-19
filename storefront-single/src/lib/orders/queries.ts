/**
 * Read-side queries for the orders collection. Server-only — uses `getDb`.
 *
 * Invariants:
 *   - `buildListFilter` is pure; snapshot-tested for filter shape stability.
 *   - `q` (free-text search) escapes regex metacharacters, uppercases for
 *     `orderId` (which is uppercase hex on persistence), and case-insensitive
 *     for email/phone/name.
 *   - `listOrders` returns total + KPIs grouped by currency. Mixed-currency
 *     filters are valid (e.g. status=all across markets) — the dashboard
 *     renders one KPI card per currency rather than summing.
 *   - `ensureOrdersIndexes` is idempotent (Mongo no-ops existing indexes).
 *     Called lazily on first list/get; mirrors `carts.ts:14`.
 * Side effects: reads from `orders` collection; creates indexes on first call.
 */
import { getDb } from '@/lib/mongodb';
import type { MarketKey, CurrencyCode } from '@/lib/market';
import type { OrderStatus, FulfillmentStatus } from './status-machine';
import type { OrderDoc } from './types';
import { ORDERS_COLLECTION } from './types';

export interface ListOrdersFilters {
  status?: OrderStatus | 'all';
  paymentMethod?: 'cod' | 'card' | 'all';
  market?: MarketKey | 'all';
  fulfillment?: FulfillmentStatus | 'all';
  q?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  limit?: number;
}

export interface CurrencyKpi {
  currency: CurrencyCode;
  count: number;
  revenue: number;
  avgOrder: number;
}

export interface ListOrdersResult {
  orders: OrderDoc[];
  total: number;
  kpisByCurrency: CurrencyKpi[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pure: builds the Mongo filter document from the merchant's filter inputs.
 * Snapshot-tested separately so we don't have to mock the DB to verify
 * filter-shape stability.
 */
export function buildListFilter(f: ListOrdersFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (f.status && f.status !== 'all') filter.status = f.status;
  if (f.paymentMethod && f.paymentMethod !== 'all') filter.paymentMethod = f.paymentMethod;
  if (f.market && f.market !== 'all') filter.market = f.market;

  if (f.fulfillment && f.fulfillment !== 'all') {
    if (f.fulfillment === 'unfulfilled') {
      // 'unfulfilled' covers older docs that lack the field entirely as well as
      // explicit `fulfillment.status: 'unfulfilled'`.
      filter.$or = [
        { fulfillment: { $exists: false } },
        { 'fulfillment.status': 'unfulfilled' },
      ];
    } else {
      filter['fulfillment.status'] = f.fulfillment;
    }
  }

  if (f.from || f.to) {
    const range: Record<string, Date> = {};
    if (f.from) range.$gte = f.from;
    if (f.to) range.$lte = f.to;
    filter.createdAt = range;
  }

  const q = f.q?.trim();
  if (q) {
    const escaped = escapeRegex(q);
    const ci = { $regex: escaped, $options: 'i' };
    const orderIdMatch = { $regex: escapeRegex(q.toUpperCase()) };
    filter.$and = [
      {
        $or: [
          { orderId: orderIdMatch },
          { email: ci },
          { 'shipping.firstName': ci },
          { 'shipping.lastName': ci },
          { 'shipping.phone': ci },
        ],
      },
    ];
  }

  return filter;
}

let indexesEnsured = false;

export async function ensureOrdersIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const c = db.collection(ORDERS_COLLECTION);
  await c.createIndex({ orderId: 1 }, { unique: true });
  await c.createIndex({ 'payment.providerOrderId': 1 }, { sparse: true });
  await c.createIndex({ createdAt: -1 });
  await c.createIndex({ status: 1, createdAt: -1 });
  await c.createIndex({ email: 1, createdAt: -1 });
  indexesEnsured = true;
}

export async function listOrders(f: ListOrdersFilters): Promise<ListOrdersResult> {
  await ensureOrdersIndexes();
  const db = await getDb();
  const c = db.collection<OrderDoc>(ORDERS_COLLECTION);
  const filter = buildListFilter(f);

  const skip = Math.max(0, f.skip ?? 0);
  const limit = Math.min(Math.max(1, f.limit ?? 50), 10_000);

  const [orders, total, kpisAgg] = await Promise.all([
    c
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
      .then((rows) => rows as unknown as OrderDoc[]),
    c.countDocuments(filter),
    c
      .aggregate<{ _id: CurrencyCode | null; count: number; revenue: number }>([
        { $match: filter },
        {
          $group: {
            _id: '$currency',
            count: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$totalPrice', 0] } },
          },
        },
      ])
      .toArray(),
  ]);

  const kpisByCurrency: CurrencyKpi[] = kpisAgg
    .filter((row): row is { _id: CurrencyCode; count: number; revenue: number } =>
      row._id === 'EUR',
    )
    .map((row) => ({
      currency: row._id,
      count: row.count,
      revenue: row.revenue,
      avgOrder: row.count > 0 ? row.revenue / row.count : 0,
    }));

  return { orders, total, kpisByCurrency };
}

export async function getOrder(orderId: string): Promise<OrderDoc | null> {
  await ensureOrdersIndexes();
  const db = await getDb();
  const doc = await db.collection<OrderDoc>(ORDERS_COLLECTION).findOne({ orderId });
  return (doc as unknown as OrderDoc | null) ?? null;
}
