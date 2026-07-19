import Link from 'next/link';
import { getDb } from '@/lib/mongodb';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import {
  CARTS_COLLECTION,
  type CartDoc,
  type CartStatus,
} from '@/plugins/abandoned-cart/shared/types';
import { formatPrice } from '@/lib/format';
import styles from '../Admin.module.css';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface DashboardData {
  counts: Record<CartStatus, number>;
  recoveryRate7d: { numerator: number; denominator: number; rate: number };
  recent: CartDoc[];
  totalCarts: number;
  configured: boolean;
}

async function loadDashboard(skip: number, limit: number): Promise<DashboardData> {
  if (isAbandonedCartDryRun()) {
    return {
      counts: { active: 0, abandoned: 0, recovered: 0, completed: 0 },
      recoveryRate7d: { numerator: 0, denominator: 0, rate: 0 },
      recent: [],
      totalCarts: 0,
      configured: false,
    };
  }
  const db = await getDb();
  const carts = db.collection<CartDoc>(CARTS_COLLECTION);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    active,
    abandoned,
    recovered,
    completed,
    totalCarts,
    recent,
    recovered7d,
    abandoned7d,
  ] = await Promise.all([
    carts.countDocuments({ status: 'active' }),
    carts.countDocuments({ status: 'abandoned' }),
    carts.countDocuments({ status: 'recovered' }),
    carts.countDocuments({ status: 'completed' }),
    carts.countDocuments({}),
    carts
      .find({})
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    carts.countDocuments({
      status: { $in: ['recovered', 'completed'] },
      recoveredAt: { $gte: sevenDaysAgo },
    }),
    carts.countDocuments({
      status: { $in: ['abandoned', 'recovered', 'completed'] },
      abandonedAt: { $gte: sevenDaysAgo },
    }),
  ]);

  return {
    counts: { active, abandoned, recovered, completed },
    recoveryRate7d: {
      numerator: recovered7d,
      denominator: abandoned7d,
      rate: abandoned7d ? recovered7d / abandoned7d : 0,
    },
    recent,
    totalCarts,
    configured: true,
  };
}

function StatusBadge({ status }: { status: CartStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
      {status}
    </span>
  );
}

function formatDate(d: Date | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' });
}

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

interface PageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requestedPage = parsePage(sp.page);
  const skip = (requestedPage - 1) * PAGE_SIZE;
  const data = await loadDashboard(skip, PAGE_SIZE);
  const { counts, recoveryRate7d, recent, totalCarts, configured } = data;

  const totalPages = Math.max(1, Math.ceil(totalCarts / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const rangeStart = totalCarts === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCarts, page * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Cart dashboard</h1>

      {!configured && (
        <div className={styles.warn}>
          MongoDB is not configured (or ABANDONED_CART_DRY_RUN=1). All values
          shown are zero. Set MONGODB_URI to see live data.
        </div>
      )}

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Active</span>
          <span className={styles.cardValue}>{counts.active}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Abandoned</span>
          <span className={styles.cardValue}>{counts.abandoned}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Recovered</span>
          <span className={styles.cardValue}>{counts.recovered}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Completed (orders)</span>
          <span className={styles.cardValue}>{counts.completed}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Recovery rate (7d)</span>
          <span className={styles.cardValue}>
            {(recoveryRate7d.rate * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <h2 className={styles.subheading}>Recent activity</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cart</th>
              <th>Email</th>
              <th>Items</th>
              <th>Subtotal</th>
              <th>Status</th>
              <th>Step</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  No carts yet.
                </td>
              </tr>
            ) : (
              recent.map((cart) => (
                <tr key={cart.cartId}>
                  <td className="mono" data-label="Cart">
                    <Link href={`/admin/cart/${cart.cartId}`}>
                      {cart.cartId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td data-label="Email">{cart.email ?? '—'}</td>
                  <td data-label="Items">
                    {cart.items.reduce((sum, it) => sum + it.quantity, 0)}
                  </td>
                  <td data-label="Subtotal">{formatPrice(cart.subtotal)}</td>
                  <td data-label="Status"><StatusBadge status={cart.status} /></td>
                  <td data-label="Step">{cart.recoveryStep}</td>
                  <td className="mono" data-label="Last activity">
                    {formatDate(cart.lastActivityAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {totalCarts === 0
            ? 'No carts'
            : `${rangeStart}–${rangeEnd} of ${totalCarts} · page ${page} of ${totalPages}`}
        </span>
        <div className={styles.pageNav}>
          <Link
            href={hasPrev ? `/admin?page=${page - 1}` : '/admin'}
            className={`${styles.pageBtn} ${hasPrev ? '' : styles.pageBtnDisabled}`}
            aria-disabled={!hasPrev}
          >
            ← Prev
          </Link>
          <Link
            href={hasNext ? `/admin?page=${page + 1}` : '/admin'}
            className={`${styles.pageBtn} ${hasNext ? '' : styles.pageBtnDisabled}`}
            aria-disabled={!hasNext}
          >
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}
