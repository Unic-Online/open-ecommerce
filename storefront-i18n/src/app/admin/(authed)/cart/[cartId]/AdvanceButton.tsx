'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../Admin.module.css';

interface Props {
  cartId: string;
  currentStep: number;
  cartStatus: string;
}

const REASON_COPY: Record<string, string> = {
  'unknown-cart': 'Cart not found.',
  completed: 'Cart already completed — no further emails.',
  recovered: 'Cart already recovered.',
  'no-email': 'Cart has no email bound; cannot send a recovery email.',
  empty: 'Cart has no items.',
  'max-step': 'Already at step 3 (final).',
  'race-lost': 'Lost the race against the cron tick — refresh to see new state.',
  'dry-run': 'MongoDB not configured; nothing to advance.',
};

export default function AdvanceButton({ cartId, currentStep, cartStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [last, setLast] = useState<{ step?: number; coupon?: string } | null>(null);

  const disabled =
    busy ||
    currentStep >= 3 ||
    cartStatus === 'completed' ||
    cartStatus === 'recovered';

  async function advance() {
    setBusy(true);
    setError('');
    setLast(null);
    try {
      const res = await fetch(
        `/api/admin/cart/${encodeURIComponent(cartId)}/advance`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const reason: string | undefined = json.reason;
        setError(reason ? REASON_COPY[reason] || `Failed (${reason}).` : 'Failed.');
        return;
      }
      setLast({
        step: json.toStep,
        coupon: json.couponCode,
      });
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
        onClick={advance}
        disabled={disabled}
        className={styles.btnPrimary}
      >
        {busy ? 'Advancing…' : `Force-advance to step ${Math.min(currentStep + 1, 3)}`}
      </button>
      {error && <span className={styles.errorText}>{error}</span>}
      {last && (
        <span className={styles.okText}>
          Advanced to step {last.step}
          {last.coupon ? ` — coupon ${last.coupon}` : ''}.
        </span>
      )}
    </div>
  );
}
