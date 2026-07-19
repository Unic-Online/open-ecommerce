// Tracks the recovery coupon that the user activated by clicking the link
// in a recovery email. Persisted to localStorage so the cart + checkout
// pages can show "COD APLICAT" and stack the discount.
//
// The coupon is server-validated at issue time (via the recovery cron) and
// re-validated atomically at order placement (via /api/order →
// redeemCoupon). The client copy is purely for UX; the server is always
// the source of truth.

const STORAGE_KEY = 'sf_applied_coupon';

export interface AppliedCoupon {
  code: string;
  discountPercent: number;
  validUntil: string; // ISO timestamp
  email?: string;
}

// Single validation source for both readers below. Distinguishes "expired"
// (so readAppliedCoupon can prune storage) from plain malformed/absent.
function parseStoredCoupon(raw: string | null): { coupon: AppliedCoupon | null; expired: boolean } {
  if (!raw) return { coupon: null, expired: false };
  try {
    const parsed = JSON.parse(raw) as AppliedCoupon;
    if (!parsed?.code || typeof parsed.discountPercent !== 'number') {
      return { coupon: null, expired: false };
    }
    if (parsed.validUntil) {
      const exp = new Date(parsed.validUntil).getTime();
      if (Number.isFinite(exp) && exp < Date.now()) {
        return { coupon: null, expired: true };
      }
    }
    return { coupon: parsed, expired: false };
  } catch {
    return { coupon: null, expired: false };
  }
}

export function readAppliedCoupon(): AppliedCoupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const { coupon, expired } = parseStoredCoupon(raw);
    if (expired) localStorage.removeItem(STORAGE_KEY);
    return coupon;
  } catch {
    return null;
  }
}

// useSyncExternalStore support. Pure (no storage pruning) and cached on the
// raw string so the returned object is referentially stable across renders.
let snapshotCache: { raw: string | null; value: AppliedCoupon | null } | null = null;

export function getAppliedCouponSnapshot(): AppliedCoupon | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (snapshotCache && snapshotCache.raw === raw) return snapshotCache.value;
  const value = parseStoredCoupon(raw).coupon;
  snapshotCache = { raw, value };
  return value;
}

export function getAppliedCouponServerSnapshot(): AppliedCoupon | null {
  return null;
}

export function storeAppliedCoupon(coupon: AppliedCoupon): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coupon));
  } catch {
    /* storage unavailable */
  }
}

export function clearAppliedCoupon(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
