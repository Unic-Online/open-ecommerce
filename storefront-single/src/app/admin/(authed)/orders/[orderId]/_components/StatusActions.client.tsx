'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ALLOWED_TRANSITIONS,
  type OrderStatus,
} from '@/lib/orders/status-machine';
import styles from '../../../../Admin.module.css';

interface Props {
  orderId: string;
  status: OrderStatus;
}

const REASON_COPY: Record<string, string> = {
  'illegal-transition': 'Transition not allowed from the current status.',
  'not-found': 'Order not found.',
  'dry-run': 'MongoDB not configured; nothing to update.',
  unauthenticated: 'Session expired. Sign in again.',
  malformed: 'Bad request.',
};

export function StatusActions({ orderId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState('');

  const targets = ALLOWED_TRANSITIONS[status];

  if (targets.length === 0) {
    return (
      <p className={styles.helpText}>
        Status <strong>{status}</strong> is terminal — no further transitions.
      </p>
    );
  }

  async function transition(to: OrderStatus) {
    setBusy(to);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const reason: string | undefined = json.reason;
        setError(reason ? REASON_COPY[reason] || `Failed (${reason}).` : 'Failed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.actionRow}>
      {targets.map((to) => (
        <button
          key={to}
          type="button"
          onClick={() => transition(to)}
          disabled={busy !== null}
          className={styles.pageBtn}
        >
          {busy === to ? `Moving to ${to}…` : `→ ${to}`}
        </button>
      ))}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}
