'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../../Admin.module.css';

interface Props {
  orderId: string;
  totalPrice: number;
  currency: 'RON' | 'EUR';
  alreadyRefunded: boolean;
}

const REASON_COPY: Record<string, string> = {
  'invalid-amount': 'Amount must be > 0 and ≤ order total.',
  'already-refunded': 'This order is already refunded.',
  'illegal-transition': 'Order status does not allow refund (only received/paid).',
  'not-found': 'Order not found.',
  'dry-run': 'MongoDB not configured.',
  unauthenticated: 'Session expired.',
  malformed: 'Bad request.',
};

export function RefundForm({ orderId, totalPrice, currency, alreadyRefunded }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>(String(totalPrice));
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (alreadyRefunded) {
    return (
      <p className={styles.helpText}>
        Refund already recorded. Subsequent refunds must be tracked outside this
        dashboard.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // re-entrancy guard: never fire a second refund while one is in flight
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(REASON_COPY['invalid-amount']);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: n, reason, reference }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const r: string | undefined = json.reason;
        setError(r ? REASON_COPY[r] || `Failed (${r}).` : 'Failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${styles.filterBar} ${styles.stack}`}>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Amount ({currency})</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label className={`${styles.filterField} ${styles.grow}`}>
        <span className={styles.filterLabel}>Reason (internal)</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="damaged on arrival, customer request…"
        />
      </label>
      <label className={`${styles.filterField} ${styles.grow}`}>
        <span className={styles.filterLabel}>Provider reference</span>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Revolut refund ID"
        />
      </label>
      <div className={styles.filterActions}>
        <button type="submit" disabled={busy} className={styles.btnDanger}>
          {busy ? 'Recording…' : 'Record refund'}
        </button>
      </div>
      <div className={`${styles.spanAll} ${styles.helpText}`}>
        v1 does not call Revolut. Trigger the refund there separately, then
        record the refund ID here so the audit log lines up.
      </div>
      {error && <div className={`${styles.spanAll} ${styles.errorText}`}>{error}</div>}
    </form>
  );
}
