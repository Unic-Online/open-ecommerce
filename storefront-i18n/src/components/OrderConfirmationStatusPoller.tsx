'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  intervalMs?: number;
  maxAttempts?: number;
}

const DEFAULT_INTERVAL_MS = 4000;
const DEFAULT_MAX_ATTEMPTS = 8;

/**
 * Bounded client-side poller for the confirmation page. Renders nothing.
 *
 * Why this exists: a card payment redirect can land on /confirmare/[orderId]
 * a few seconds before Revolut's webhook flips the doc to `paid`. We need to
 * re-render the page until the webhook lands (or we give up).
 *
 * Why it replaced `<meta http-equiv="refresh" />`:
 *   - meta-refresh is a browser-level timer that survives a Next.js soft
 *     navigation. A customer who clicked "Vezi comenzile mele" would get
 *     yanked back to /confirmare 4s later because the meta-refresh fires
 *     against the original document.
 *   - meta-refresh polls forever; an abandoned card session keeps hitting
 *     Revolut's API every 4 seconds for the lifetime of that tab.
 * router.refresh() does a soft re-render of server components, and React
 * tears the interval down on unmount — so soft-navigating away is silent.
 */
export default function OrderConfirmationStatusPoller({
  intervalMs = DEFAULT_INTERVAL_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: Props) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= maxAttempts) return;
    const id = window.setTimeout(() => {
      router.refresh();
      setAttempts((n) => n + 1);
    }, intervalMs);
    return () => window.clearTimeout(id);
  }, [attempts, intervalMs, maxAttempts, router]);

  return null;
}
