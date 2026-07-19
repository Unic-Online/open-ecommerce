'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../Admin.module.css';

interface Props {
  reviewId: string;
}

const REASON_COPY: Record<string, string> = {
  'already-decided': 'Already decided (by another tab/admin).',
  'not-found': 'Review not found.',
  'dry-run': 'MongoDB not configured; nothing to update.',
  unauthenticated: 'Session expired. Sign in again.',
  malformed: 'Bad request.',
};

export function ReviewDecisionButtons({ reviewId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState('');

  async function decide(action: 'approve' | 'decline') {
    setBusy(action);
    setError('');
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
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
      <button
        type="button"
        onClick={() => decide('approve')}
        disabled={busy !== null}
        className={styles.pageBtn}
      >
        {busy === 'approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        onClick={() => decide('decline')}
        disabled={busy !== null}
        className={styles.pageBtn}
      >
        {busy === 'decline' ? 'Declining…' : 'Decline'}
      </button>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}
