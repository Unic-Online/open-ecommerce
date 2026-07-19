'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../Admin.module.css';

interface Props {
  cartId: string;
  cartStatus: string;
}

const REASON_COPY: Record<string, string> = {
  'unknown-cart': 'Cart not found.',
  completed: 'Cart is completed — order-linked, cannot reset.',
  'dry-run': 'MongoDB not configured; nothing to reset.',
};

export default function ResetRecoveryButton({ cartId, cartStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const disabled = busy || cartStatus === 'completed';

  async function reset() {
    if (!confirm('Reset recovery state? Clears step + recoveryEmails history.')) {
      return;
    }
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const res = await fetch(
        `/api/admin/cart/${encodeURIComponent(cartId)}/reset-recovery`,
        { method: 'POST' },
      );
      const json = await res.json();
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
        onClick={reset}
        disabled={disabled}
        className={styles.btnDanger}
      >
        {busy ? 'Resetting…' : 'Reset recovery state'}
      </button>
      {error && <span className={styles.errorText}>{error}</span>}
      {done && (
        <span className={styles.okText}>
          Recovery state cleared. Force-advance can now restart from step 1.
        </span>
      )}
    </div>
  );
}
