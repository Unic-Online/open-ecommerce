import type { OrderDoc } from '@/lib/orders/types';
import styles from '../../../../Admin.module.css';

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotesBlock({ order }: { order: OrderDoc }) {
  const notes = order.notes ?? [];
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {notes.length === 0 ? (
            <tr>
              <td colSpan={2} className={styles.empty}>
                No internal notes.
              </td>
            </tr>
          ) : (
            notes
              .slice()
              .reverse()
              .map((note, i) => (
                <tr key={i}>
                  <td className="mono" data-label="When">
                    {formatDate(note.createdAt)}
                  </td>
                  <td data-label="Note" className={styles.cellPre}>
                    {note.body}
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}
