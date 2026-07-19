import Link from 'next/link';
import { getDb } from '@/lib/mongodb';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import {
  COUPONS_COLLECTION,
  type CouponDoc,
} from '@/plugins/abandoned-cart/shared/types';
import styles from '../../Admin.module.css';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

async function loadCoupons(
  skip: number,
  limit: number,
): Promise<{ coupons: CouponDoc[]; total: number; now: number }> {
  // Why: Date.now() is captured here (data load) rather than in the component
  // body — components must stay pure (react-hooks purity rule).
  if (isAbandonedCartDryRun()) return { coupons: [], total: 0, now: Date.now() };
  const db = await getDb();
  const collection = db.collection<CouponDoc>(COUPONS_COLLECTION);
  const [coupons, total] = await Promise.all([
    collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments({}),
  ]);
  return { coupons, total, now: Date.now() };
}

function formatDate(d: Date | string | undefined | null): string {
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

export default async function AdminCouponsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const requestedPage = parsePage(sp.page);
  const skip = (requestedPage - 1) * PAGE_SIZE;
  const { coupons, total, now } = await loadCoupons(skip, PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Coupons</h1>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Email</th>
              <th>%</th>
              <th>Status</th>
              <th>Issued</th>
              <th>Expires</th>
              <th>Cart</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  No coupons issued yet.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => {
                const expired = coupon.validUntil.getTime() < now;
                const used = coupon.usedCount > 0;
                const status = used ? 'redeemed' : expired ? 'expired' : 'active';
                return (
                  <tr key={coupon.code}>
                    <td className="mono" data-label="Code">
                      <strong>{coupon.code}</strong>
                    </td>
                    <td data-label="Email">{coupon.email}</td>
                    <td data-label="%">+{coupon.discountPercent}%</td>
                    <td data-label="Status">
                      <span
                        className={`${styles.statusBadge} ${
                          status === 'redeemed'
                            ? styles.status_completed
                            : status === 'expired'
                            ? styles.status_abandoned
                            : styles.status_active
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="mono" data-label="Issued">
                      {formatDate(coupon.createdAt)}
                    </td>
                    <td className="mono" data-label="Expires">
                      {formatDate(coupon.validUntil)}
                    </td>
                    <td className="mono" data-label="Cart">
                      <Link href={`/admin/cart/${coupon.cartId}`}>
                        {coupon.cartId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="mono" data-label="Order">
                      {coupon.redeemedOrderId ?? '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {total === 0
            ? 'No coupons'
            : `${rangeStart}–${rangeEnd} of ${total} · page ${page} of ${totalPages}`}
        </span>
        <div className={styles.pageNav}>
          <Link
            href={hasPrev ? `/admin/coupons?page=${page - 1}` : '/admin/coupons'}
            className={`${styles.pageBtn} ${hasPrev ? '' : styles.pageBtnDisabled}`}
            aria-disabled={!hasPrev}
          >
            ← Prev
          </Link>
          <Link
            href={hasNext ? `/admin/coupons?page=${page + 1}` : '/admin/coupons'}
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
