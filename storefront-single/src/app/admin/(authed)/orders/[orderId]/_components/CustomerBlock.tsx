import type { OrderDoc } from '@/lib/orders/types';
import styles from '../../../../Admin.module.css';

export function CustomerBlock({ order }: { order: OrderDoc }) {
  const s = order.shipping;
  const altUsed = s?.useAltShipping;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          <tr>
            <th>Name</th>
            <td>
              {s?.firstName} {s?.lastName}
            </td>
          </tr>
          <tr>
            <th>Email</th>
            <td className="mono">{order.email}</td>
          </tr>
          <tr>
            <th>Phone</th>
            <td className="mono">{s?.phone ?? '—'}</td>
          </tr>
          <tr>
            <th>Address</th>
            <td>
              {s?.address}
              <br />
              {s?.postalCode} {s?.city}, {s?.county}, {s?.country}
            </td>
          </tr>
          {s?.billingType === 'company' && (
            <tr>
              <th>Company</th>
              <td>
                {s.companyName}
                <span className={styles.cellSub}>
                  CUI {s.companyCui} · Reg. Com. {s.companyRegCom}
                </span>
              </td>
            </tr>
          )}
          {altUsed && (
            <tr>
              <th>Ship to</th>
              <td>
                {s?.altAddress}
                <br />
                {s?.altPostalCode} {s?.altCity}, {s?.altCounty}, {s?.altCountry}
              </td>
            </tr>
          )}
          <tr>
            <th>Marketing consent</th>
            <td>{order.marketingConsent ? 'yes' : 'no'}</td>
          </tr>
          <tr>
            <th>IP / UA</th>
            <td className={`mono ${styles.cellBreak}`}>
              {order.clientIp ?? '—'}
              <br />
              {order.clientUserAgent ?? '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
