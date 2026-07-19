import type { OrderDoc } from '@/lib/orders/types';
import styles from '../../../../Admin.module.css';

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function OrderHeader({ order }: { order: OrderDoc }) {
  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Order</span>
        <span className={`${styles.cardValue} mono`}>#{order.orderId}</span>
        <span className={styles.cardSub}>{formatDate(order.createdAt)}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Status</span>
        <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
          {order.status}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Fulfillment</span>
        <span
          className={`${styles.statusBadge} ${
            styles[`fulfill_${order.fulfillment?.status ?? 'unfulfilled'}`]
          }`}
        >
          {order.fulfillment?.status ?? 'unfulfilled'}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Payment</span>
        <span className={styles.cardValue}>{order.paymentMethod}</span>
      </div>
      <div className={styles.card}>
        <span className={styles.cardLabel}>Market</span>
        <span className={`${styles.statusBadge} ${styles[`market_${order.market}`]}`}>
          {order.market}
        </span>
        <span className={styles.cardSub}>
          {order.currency}
        </span>
      </div>
    </div>
  );
}
