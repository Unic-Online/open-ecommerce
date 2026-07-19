import Link from 'next/link';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { listReviews, type ReviewDoc, type ReviewStatus } from '@/lib/reviews-store';
import { ReviewDecisionButtons } from './_components/ReviewDecisionButtons.client';
import styles from '../../Admin.module.css';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type StatusParam = ReviewStatus | 'all';

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const STATUS_OPTIONS: ReadonlyArray<StatusParam> = ['pending', 'approved', 'declined', 'all'];

function parsePage(raw: unknown): number {
  const n = Number.parseInt(typeof raw === 'string' ? raw : '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function pickStatus(raw: unknown): StatusParam {
  return typeof raw === 'string' && (STATUS_OPTIONS as ReadonlyArray<string>).includes(raw)
    ? (raw as StatusParam)
    : 'pending';
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`${styles.statusBadge} ${styles[`review_${status}`]}`}>{status}</span>;
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = pickStatus(sp.status);
  const page = parsePage(sp.page);

  if (isAbandonedCartDryRun()) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Reviews</h1>
        <div className={styles.warn}>
          MongoDB is not configured (or ABANDONED_CART_DRY_RUN=1). Set MONGODB_URI to see live data.
        </div>
      </div>
    );
  }

  const { reviews, total } = await listReviews({
    status,
    skip: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (status !== 'pending') params.set('status', status);
    if (p !== 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/admin/reviews?${s}` : '/admin/reviews';
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Reviews</h1>

      <form method="GET" className={styles.filterBar}>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>Status</span>
          <select name="status" defaultValue={status}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.btnPrimary}>
            Apply
          </button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Product</th>
              <th>Name</th>
              <th>Rating</th>
              <th>Text</th>
              <th>Verified</th>
              <th>Locale</th>
              <th>Status</th>
              {status === 'pending' && <th>Decision</th>}
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={status === 'pending' ? 9 : 8} className={styles.empty}>
                  No reviews match this filter.
                </td>
              </tr>
            ) : (
              reviews.map((r: ReviewDoc) => (
                <tr key={r._id!.toHexString()}>
                  <td className="mono" data-label="Submitted">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="mono" data-label="Product">
                    {r.slug}
                  </td>
                  <td data-label="Name">
                    <strong>{r.name}</strong>
                    {r.email && <span className={styles.cellSub}>{r.email}</span>}
                  </td>
                  <td data-label="Rating">{r.rating}/5</td>
                  <td data-label="Text">
                    {r.title && <strong>{r.title}</strong>}
                    <p className={styles.cellSub}>
                      {r.text.length > 160 ? `${r.text.slice(0, 160)}…` : r.text}
                    </p>
                  </td>
                  <td data-label="Verified">{r.verifiedPurchase ? 'Yes' : 'No'}</td>
                  <td data-label="Locale">{r.locale}</td>
                  <td data-label="Status">
                    <StatusBadge status={r.status} />
                  </td>
                  {status === 'pending' && (
                    <td data-label="Decision">
                      <ReviewDecisionButtons reviewId={r._id!.toHexString()} />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          {total === 0 ? 'No reviews' : `page ${page} of ${totalPages} · ${total} total`}
        </span>
        <div className={styles.pageNav}>
          {hasPrev ? (
            <Link href={pageHref(page - 1)} className={styles.pageBtn} rel="prev">
              ← Prev
            </Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`} aria-disabled="true">
              ← Prev
            </span>
          )}
          {hasNext ? (
            <Link href={pageHref(page + 1)} className={styles.pageBtn} rel="next">
              Next →
            </Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`} aria-disabled="true">
              Next →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
