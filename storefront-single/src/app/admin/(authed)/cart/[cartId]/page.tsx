import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findCart } from '@/plugins/abandoned-cart/server/carts';
import { isAbandonedCartDryRun } from '@/plugins/abandoned-cart/config';
import { formatPrice } from '@/lib/format';
import AdvanceButton from './AdvanceButton';
import ResetRecoveryButton from './ResetRecoveryButton';
import styles from '../../../Admin.module.css';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ cartId: string }>;
}

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function AdminCartDetail({ params }: Props) {
  const { cartId } = await params;
  if (isAbandonedCartDryRun()) {
    return (
      <div className={styles.page}>
        <Link href="/admin" className={styles.backLink}>← Back</Link>
        <div className={styles.warn}>DB not configured. Cart detail unavailable.</div>
      </div>
    );
  }

  const cart = await findCart(cartId);
  if (!cart) notFound();

  const totalQty = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className={styles.page}>
      <Link href="/admin" className={styles.backLink}>← Back to dashboard</Link>
      <h1 className={styles.heading}>Cart {cart.cartId.slice(0, 8)}…</h1>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Status</span>
          <span className={`${styles.statusBadge} ${styles[`status_${cart.status}`]}`}>
            {cart.status}
          </span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Recovery step</span>
          <span className={styles.cardValue}>{cart.recoveryStep}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Items</span>
          <span className={styles.cardValue}>{totalQty}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Subtotal</span>
          <span className={styles.cardValue}>{formatPrice(cart.subtotal)}</span>
        </div>
      </div>

      <h2 className={styles.subheading}>Customer</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <tbody>
            <tr><th>Email</th><td>{cart.email ?? '—'}</td></tr>
            <tr><th>Phone</th><td>{cart.phone ?? '—'}</td></tr>
            <tr><th>Marketing consent</th><td>{cart.marketingConsent ? 'yes' : 'no'}</td></tr>
            <tr><th>IP address</th><td className="mono">{cart.ipAddress ?? '—'}</td></tr>
            <tr><th>User agent</th><td className="mono">{cart.userAgent ?? '—'}</td></tr>
            <tr><th>Coupon</th><td className="mono">{cart.couponCode ?? '—'}</td></tr>
            <tr><th>Order</th><td className="mono">{cart.orderId ?? '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className={styles.subheading}>Items</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {cart.items.length === 0 ? (
              <tr><td colSpan={4} className={styles.empty}>No items.</td></tr>
            ) : (
              cart.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Product">
                    <strong>{item.productName}</strong>
                    <span className={styles.cellSub}>{item.id}</span>
                  </td>
                  <td data-label="Qty">{item.quantity}</td>
                  <td data-label="Unit">{formatPrice(item.unitPrice)}</td>
                  <td data-label="Line total">{formatPrice(item.unitPrice * item.quantity)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className={styles.subheading}>Timeline</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <tbody>
            <tr><th>Created</th><td className="mono">{formatDate(cart.createdAt)}</td></tr>
            <tr><th>Last activity</th><td className="mono">{formatDate(cart.lastActivityAt)}</td></tr>
            <tr><th>Abandoned at</th><td className="mono">{formatDate(cart.abandonedAt)}</td></tr>
            <tr><th>Recovered at</th><td className="mono">{formatDate(cart.recoveredAt)}</td></tr>
            <tr><th>Completed at</th><td className="mono">{formatDate(cart.completedAt)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className={styles.subheading}>Force advance</h2>
      <p className={styles.helpText}>
        Bumps the cart to the next recovery step right now, skipping the cron&apos;s
        time gates. Sends the corresponding email via Resend (subject to dry-run flags).
      </p>
      <AdvanceButton
        cartId={cart.cartId}
        currentStep={cart.recoveryStep}
        cartStatus={cart.status}
      />

      <h2 className={styles.subheading}>Reset recovery</h2>
      <p className={styles.helpText}>
        Clears <code>recoveryStep</code>, drops <code>recoveryEmails[]</code>, unsets
        coupon and <code>abandonedAt</code>. The funnel can run from step 1 again
        (cron pickup or admin force-advance). Refused on completed carts.
      </p>
      <ResetRecoveryButton cartId={cart.cartId} cartStatus={cart.status} />

      <h2 className={styles.subheading}>Recovery emails sent</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Step</th><th>Sent at</th><th>Resend message id</th></tr>
          </thead>
          <tbody>
            {cart.recoveryEmails.length === 0 ? (
              <tr><td colSpan={3} className={styles.empty}>No recovery emails sent yet.</td></tr>
            ) : (
              cart.recoveryEmails.map((entry, i) => (
                <tr key={i}>
                  <td data-label="Step">{entry.step}</td>
                  <td className="mono" data-label="Sent at">{formatDate(entry.sentAt)}</td>
                  <td className="mono" data-label="Resend id">{entry.messageId ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
