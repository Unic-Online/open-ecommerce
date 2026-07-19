'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../../Admin.module.css';

const REASON_COPY: Record<string, string> = {
  'not-shipped': 'Order is not in a shipped state.',
  'not-found': 'Order not found.',
  'send-failed': 'Resend rejected the request.',
  'dry-run': 'MongoDB not configured.',
};

export function ResendShipmentEmailButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function resend() {
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/resend-shipment-email`,
        { method: 'POST' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const reason: string | undefined = json.reason;
        setError(reason ? REASON_COPY[reason] || `Failed (${reason}).` : 'Failed.');
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.actionRow}>
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className={styles.pageBtn}
      >
        {busy ? 'Sending…' : 'Resend shipment email'}
      </button>
      {error && <span className={styles.errorText}>{error}</span>}
      {done && !error && <span className={styles.okText}>Sent.</span>}
    </div>
  );
}
