import type { OrderDoc } from '@/lib/orders/types';
import styles from '../../../../Admin.module.css';

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function PaymentBlock({ order }: { order: OrderDoc }) {
  if (order.paymentMethod !== 'card') {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <tbody>
            <tr>
              <th>Method</th>
              <td>Cash on delivery</td>
            </tr>
            <tr>
              <th>Email confirmed</th>
              <td className="mono">{formatDate(order.emailSentAt)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const p = order.payment;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          <tr>
            <th>Method</th>
            <td>Card · Revolut</td>
          </tr>
          <tr>
            <th>Provider order ID</th>
            <td className={`mono ${styles.cellBreak}`}>
              {p?.providerOrderId ?? '—'}
            </td>
          </tr>
          <tr>
            <th>Public ID</th>
            <td className={`mono ${styles.cellBreak}`}>
              {p?.providerPublicId ?? '—'}
            </td>
          </tr>
          <tr>
            <th>State</th>
            <td className="mono">{p?.state ?? '—'}</td>
          </tr>
          <tr>
            <th>Initiated at</th>
            <td className="mono">{formatDate(p?.initiatedAt)}</td>
          </tr>
          <tr>
            <th>Paid at</th>
            <td className="mono">{formatDate(p?.paidAt)}</td>
          </tr>
          <tr>
            <th>Last webhook</th>
            <td className="mono">{p?.lastWebhookEvent ?? '—'}</td>
          </tr>
          <tr>
            <th>Email confirmed</th>
            <td className="mono">{formatDate(order.emailSentAt)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
