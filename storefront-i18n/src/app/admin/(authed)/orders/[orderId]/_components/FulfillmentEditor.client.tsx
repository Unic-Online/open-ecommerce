'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
} from '@/lib/orders/status-machine';
import styles from '../../../../Admin.module.css';

interface Props {
  orderId: string;
  initial: {
    status: FulfillmentStatus;
    carrier: string;
    trackingNumber: string;
  };
  shipmentEmailAlreadySent: boolean;
}

const REASON_COPY: Record<string, string> = {
  'not-found': 'Order not found.',
  'terminal-status': 'Order is in a terminal status — fulfillment is locked.',
  'dry-run': 'MongoDB not configured.',
  unauthenticated: 'Session expired.',
  malformed: 'Bad request.',
};

export function FulfillmentEditor({ orderId, initial, shipmentEmailAlreadySent }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<FulfillmentStatus>(initial.status);
  const [carrier, setCarrier] = useState(initial.carrier);
  const [trackingNumber, setTrackingNumber] = useState(initial.trackingNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/fulfillment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, carrier, trackingNumber }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        const reason: string | undefined = json.reason;
        setError(reason ? REASON_COPY[reason] || `Failed (${reason}).` : 'Failed.');
        return;
      }
      if (json.shipmentEmailSent) {
        setInfo('Saved. Shipment email sent to customer.');
      } else if (json.sendError) {
        setInfo(`Saved, but shipment email failed: ${json.sendError}`);
      } else {
        setInfo('Saved.');
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
        <span className={styles.filterLabel}>Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FulfillmentStatus)}
        >
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Carrier</span>
        <input
          type="text"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="Sameday, FAN, DHL…"
        />
      </label>
      <label className={`${styles.filterField} ${styles.grow}`}>
        <span className={styles.filterLabel}>Tracking number (AWB)</span>
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />
      </label>
      <div className={styles.filterActions}>
        <button type="submit" disabled={busy} className={styles.btnPrimary}>
          {busy ? 'Saving…' : 'Save fulfillment'}
        </button>
      </div>
      <div className={`${styles.spanAll} ${styles.helpText}`}>
        {shipmentEmailAlreadySent
          ? 'Shipment email already sent — further edits will not re-trigger it.'
          : status === 'shipped' && trackingNumber.trim()
            ? 'Saving will mark as shipped and email the customer.'
            : 'Customer is emailed automatically when status flips to shipped with a tracking number.'}
      </div>
      {error && <div className={`${styles.spanAll} ${styles.errorText}`}>{error}</div>}
      {info && <div className={`${styles.spanAll} ${styles.okText}`}>{info}</div>}
    </form>
  );
}
