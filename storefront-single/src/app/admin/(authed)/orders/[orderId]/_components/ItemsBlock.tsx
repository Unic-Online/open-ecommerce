import { formatOrderMoney } from '@/lib/orders/format';
import type { OrderDoc } from '@/lib/orders/types';
import styles from '../../../../Admin.module.css';

export function ItemsBlock({ order }: { order: OrderDoc }) {
  return (
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
          {order.items.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.empty}>
                No items.
              </td>
            </tr>
          ) : (
            order.items.map((item) => (
              <tr key={item.id}>
                <td data-label="Product">
                  <strong>{item.productName}</strong>
                  <span className={`${styles.cellSub} mono`}>{item.id}</span>
                </td>
                <td data-label="Qty">{item.quantity}</td>
                <td data-label="Unit">{formatOrderMoney(order, item.unitPrice)}</td>
                <td data-label="Line total">
                  {formatOrderMoney(order, item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))
          )}
          <tr>
            <th>Subtotal</th>
            <td colSpan={3} className={styles.cellRight}>
              {formatOrderMoney(order, order.subtotal)}
            </td>
          </tr>
          {order.discount > 0 && (
            <tr>
              <th>Discount</th>
              <td colSpan={3} className={styles.cellRight}>
                −{formatOrderMoney(order, order.discount)}
                {order.couponCode && (
                  <span className={`${styles.cellSub} mono`}>({order.couponCode})</span>
                )}
              </td>
            </tr>
          )}
          <tr>
            <th>Shipping</th>
            <td colSpan={3} className={styles.cellRight}>
              {formatOrderMoney(order, order.shippingCost)}
            </td>
          </tr>
          <tr>
            <th>Total</th>
            <td colSpan={3} className={styles.cellTotal}>
              {formatOrderMoney(order, order.totalPrice)}
            </td>
          </tr>
          {order.refund && (
            <tr>
              <th>Refund</th>
              <td colSpan={3} className={styles.cellRefund}>
                −{formatOrderMoney(order, order.refund.amount)}
                {order.refund.reference && (
                  <span className={`${styles.cellSub} mono`}>({order.refund.reference})</span>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
