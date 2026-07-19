import Link from 'next/link';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import {
  listOrders,
  type CurrencyKpi,
  type ListOrdersFilters,
  type ListOrdersResult,
} from '@/lib/orders/queries';
import { formatMoney } from '@/lib/format';
import {
  ORDER_STATUSES,
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
  type OrderStatus,
} from '@/lib/orders/status-machine';
import type { OrderDoc } from '@/lib/orders/types';
import styles from '../../Admin.module.css';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type StatusParam = OrderStatus | 'all';
type PaymentMethodParam = 'ramburs' | 'card' | 'all';
type MarketParam = 'ro' | 'english' | 'all';
type FulfillmentParam = FulfillmentStatus | 'all';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    paymentMethod?: string;
    market?: string;
    fulfillment?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

function pickEnum<T extends string>(raw: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  return typeof raw === 'string' && (allowed as ReadonlyArray<string>).includes(raw)
    ? (raw as T)
    : fallback;
}

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePage(raw: unknown): number {
  const n = Number.parseInt(typeof raw === 'string' ? raw : '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>{status}</span>
  );
}

function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`fulfill_${status}`]}`}>{status}</span>
  );
}

const STATUS_OPTIONS: ReadonlyArray<StatusParam> = ['all', ...ORDER_STATUSES];
const PAYMENT_METHOD_OPTIONS: ReadonlyArray<PaymentMethodParam> = ['all', 'ramburs', 'card'];
const MARKET_OPTIONS: ReadonlyArray<MarketParam> = ['all', 'ro', 'english'];
const FULFILLMENT_OPTIONS: ReadonlyArray<FulfillmentParam> = ['all', ...FULFILLMENT_STATUSES];

interface ResolvedFilters {
  status: StatusParam;
  paymentMethod: PaymentMethodParam;
  market: MarketParam;
  fulfillment: FulfillmentParam;
  q: string;
  from?: Date;
  to?: Date;
  page: number;
}

function resolveFilters(sp: Awaited<PageProps['searchParams']>): ResolvedFilters {
  return {
    status: pickEnum<StatusParam>(sp.status, STATUS_OPTIONS, 'all'),
    paymentMethod: pickEnum<PaymentMethodParam>(
      sp.paymentMethod,
      PAYMENT_METHOD_OPTIONS,
      'all',
    ),
    market: pickEnum<MarketParam>(sp.market, MARKET_OPTIONS, 'all'),
    fulfillment: pickEnum<FulfillmentParam>(sp.fulfillment, FULFILLMENT_OPTIONS, 'all'),
    q: typeof sp.q === 'string' ? sp.q : '',
    from: parseDate(sp.from),
    to: parseDate(sp.to),
    page: parsePage(sp.page),
  };
}

function toQuery(filters: ResolvedFilters, overrides: Partial<{ page: number }> = {}): string {
  const params = new URLSearchParams();
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.paymentMethod !== 'all') params.set('paymentMethod', filters.paymentMethod);
  if (filters.market !== 'all') params.set('market', filters.market);
  if (filters.fulfillment !== 'all') params.set('fulfillment', filters.fulfillment);
  if (filters.q) params.set('q', filters.q);
  if (filters.from) params.set('from', filters.from.toISOString().slice(0, 10));
  if (filters.to) params.set('to', filters.to.toISOString().slice(0, 10));
  const page = overrides.page ?? filters.page;
  if (page !== 1) params.set('page', String(page));
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function loadList(
  filters: ResolvedFilters,
): Promise<{ data: ListOrdersResult; configured: boolean }> {
  if (isAbandonedCartDryRun()) {
    return {
      data: { orders: [], total: 0, kpisByCurrency: [] },
      configured: false,
    };
  }
  const queryFilters: ListOrdersFilters = {
    status: filters.status,
    paymentMethod: filters.paymentMethod,
    market: filters.market,
    fulfillment: filters.fulfillment,
    q: filters.q || undefined,
    from: filters.from,
    to: filters.to,
    skip: (filters.page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  };
  const data = await listOrders(queryFilters);
  return { data, configured: true };
}

function KpiCards({ kpis }: { kpis: CurrencyKpi[] }) {
  if (kpis.length === 0) {
    return (
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Orders</span>
          <span className={styles.cardValue}>0</span>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.cards}>
      {kpis.map((k) => (
        <div className={styles.card} key={k.currency}>
          <span className={styles.cardLabel}>{k.currency} orders</span>
          <span className={styles.cardValue}>{k.count}</span>
          <span className={styles.cardSub}>
            {formatMoney(k.revenue, k.currency, 'ro')} · avg{' '}
            {formatMoney(Math.round(k.avgOrder), k.currency, 'ro')}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilterBar({ filters }: { filters: ResolvedFilters }) {
  const fromValue = filters.from ? filters.from.toISOString().slice(0, 10) : '';
  const toValue = filters.to ? filters.to.toISOString().slice(0, 10) : '';

  return (
    <form method="GET" className={styles.filterBar}>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Status</span>
        <select name="status" defaultValue={filters.status}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Payment</span>
        <select name="paymentMethod" defaultValue={filters.paymentMethod}>
          {PAYMENT_METHOD_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Market</span>
        <select name="market" defaultValue={filters.market}>
          {MARKET_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 'english' ? 'EN' : m === 'ro' ? 'RO' : m}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Fulfillment</span>
        <select name="fulfillment" defaultValue={filters.fulfillment}>
          {FULFILLMENT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>From</span>
        <input type="date" name="from" defaultValue={fromValue} />
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>To</span>
        <input type="date" name="to" defaultValue={toValue} />
      </label>
      <label className={`${styles.filterField} ${styles.grow}`}>
        <span className={styles.filterLabel}>Search</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="orderId, email, name, phone"
        />
      </label>
      <div className={styles.filterActions}>
        <button type="submit" className={styles.btnPrimary}>
          Apply
        </button>
        <Link href="/admin/orders" className={styles.pageBtn}>
          Reset
        </Link>
      </div>
    </form>
  );
}

function MarketBadge({ market }: { market: OrderDoc['market'] }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`market_${market}`]}`}>
      {market === 'english' ? 'EN' : 'RO'}
    </span>
  );
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = resolveFilters(sp);
  const { data, configured } = await loadList(filters);
  const { orders, total, kpisByCurrency } = data;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE);

  const exportHref = `/api/admin/orders/export${toQuery(filters, { page: 1 })}`;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Orders</h1>

      {!configured && (
        <div className={styles.warn}>
          MongoDB is not configured (or ABANDONED_CART_DRY_RUN=1). All values
          shown are zero. Set MONGODB_URI to see live data.
        </div>
      )}

      <KpiCards kpis={kpisByCurrency} />

      <FilterBar filters={filters} />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Created</th>
              <th>Customer</th>
              <th>Market</th>
              <th>Total</th>
              <th>Pay</th>
              <th>Status</th>
              <th>Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  No orders match these filters.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.orderId}>
                  <td className="mono" data-label="Order">
                    <Link href={`/admin/orders/${encodeURIComponent(o.orderId)}`}>
                      #{o.orderId}
                    </Link>
                  </td>
                  <td className="mono" data-label="Created">
                    {formatDate(o.createdAt)}
                  </td>
                  <td data-label="Customer">
                    <strong>
                      {o.shipping?.firstName} {o.shipping?.lastName}
                    </strong>
                    <span className={styles.cellSub}>{o.email}</span>
                  </td>
                  <td data-label="Market">
                    <MarketBadge market={o.market} />
                  </td>
                  <td data-label="Total">
                    {formatMoney(o.totalPrice, o.currency, o.locale)}
                  </td>
                  <td data-label="Pay">{o.paymentMethod}</td>
                  <td data-label="Status">
                    <StatusBadge status={o.status} />
                  </td>
                  <td data-label="Fulfillment">
                    <FulfillmentBadge
                      status={o.fulfillment?.status ?? 'unfulfilled'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {total === 0
            ? 'No orders'
            : `${rangeStart}–${rangeEnd} of ${total} · page ${page} of ${totalPages}`}
        </span>
        <div className={styles.pageNav}>
          {hasPrev ? (
            <Link
              href={`/admin/orders${toQuery(filters, { page: page - 1 })}`}
              className={styles.pageBtn}
              rel="prev"
            >
              ← Prev
            </Link>
          ) : (
            // Disabled: render a non-focusable span (no href) so keyboard users
            // can't Tab to and activate a dead control.
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`} aria-disabled="true">
              ← Prev
            </span>
          )}
          {hasNext ? (
            <Link
              href={`/admin/orders${toQuery(filters, { page: page + 1 })}`}
              className={styles.pageBtn}
              rel="next"
            >
              Next →
            </Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`} aria-disabled="true">
              Next →
            </span>
          )}
          <a href={exportHref} className={styles.pageBtn} download>
            Export CSV
          </a>
        </div>
      </div>
    </div>
  );
}
