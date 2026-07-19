'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../../Admin.module.css';

const REASON_COPY: Record<string, string> = {
  empty: 'Note body cannot be empty.',
  'too-long': 'Note is too long (max 4 KB).',
  'not-found': 'Order not found.',
  'dry-run': 'MongoDB not configured.',
  unauthenticated: 'Session expired. Sign in again.',
  malformed: 'Bad request.',
};

export function NoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const reason: string | undefined = json.reason;
        setError(reason ? REASON_COPY[reason] || `Failed (${reason}).` : 'Failed.');
        return;
      }
      setBody('');
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.stack}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Internal note — visible to admins only."
        rows={3}
        className={styles.textarea}
      />
      <div className={styles.actionRow}>
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className={styles.pageBtn}
        >
          {busy ? 'Saving…' : 'Add note'}
        </button>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </form>
  );
}
