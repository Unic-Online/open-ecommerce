import type { AuditEntry, OrderDoc } from '@/lib/orders/types';
import styles from '../../../../Admin.module.css';

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

function summarize(entry: AuditEntry): string {
  switch (entry.kind) {
    case 'status':
      return `Status: ${entry.from} → ${entry.to}`;
    case 'fulfillment': {
      const parts = Object.entries(entry.patch)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : String(v)}`);
      return `Fulfillment: ${parts.join(', ') || '(no-op)'}`;
    }
    case 'note':
      return `Note: ${entry.body}`;
    case 'refund':
      return `Refund recorded: ${entry.amount}${
        entry.reference ? ` (ref ${entry.reference})` : ''
      }`;
    case 'email_resent':
      return `Resent ${entry.subject} email`;
    case 'shipping_edit':
      return `Shipping edited (prev: ${entry.prevShipping.address}, ${entry.prevShipping.city})`;
  }
}

export function AuditLogBlock({ order }: { order: OrderDoc }) {
  const log = (order.auditLog ?? []).slice().reverse();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>
          {log.length === 0 ? (
            <tr>
              <td colSpan={2} className={styles.empty}>
                No admin events yet.
              </td>
            </tr>
          ) : (
            log.map((entry, i) => (
              <tr key={i}>
                <td className="mono" data-label="When">
                  {formatDate(entry.at)}
                </td>
                <td data-label="Event">{summarize(entry)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
