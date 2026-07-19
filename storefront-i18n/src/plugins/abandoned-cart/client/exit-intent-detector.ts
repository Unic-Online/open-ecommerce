// Exit-intent detection. Originally a port of CartBounty Pro's detector;
// the mobile path has since been redesigned (see Trigger 2/3 below).
// CartBounty reference:
//   woo-save-abandoned-carts-pro/public/js/cartbounty-pro-public-exit-intent.js
//
// Triggers:
//   1. Desktop: mouseout/mouseleave through the top edge of the viewport.
//   2. Mobile: fast upward flick — windowed scroll velocity, touch-driven.
//   3. Mobile (optional, env-gated): back-button intercept via a same-URL
//      history sentinel.

import { storage } from '@/site.config';

const KEYS = {
  // ms timestamp of the most recent show — used for cooldown.
  lastShown: storage.localStorage.exitIntentLastShown,
} as const;

// Keys written by the removed CartBounty mobile back-button hijack. Still
// cleaned up on install so long-lived browsers don't carry stale state.
const LEGACY_MOBILE_BACK_KEYS = [
  storage.localStorage.exitIntentPopupDisplayed,
  storage.localStorage.exitIntentTouches,
  storage.localStorage.exitIntentHistoryClicks,
  storage.localStorage.exitIntentTouchesObjectDeleted,
  storage.localStorage.exitIntentJustFinishedLoop,
] as const;

// Why windowed instead of per-event delta: mobile scroll events fire once per
// display frame, so a per-event threshold is refresh-rate dependent — CartBounty's
// original -120px/event needs ~7200px/s on 60Hz and is unreachable on 120Hz
// screens. Accumulating displacement over a fixed time window measures the
// gesture, not the frame rate.
const SCROLL_WINDOW_MS = 250;
// Upward displacement within the window that reads as "flick to leave"
// (~>=1000px/s sustained). Reading scrolls run well under 500px/s.
const SCROLL_TRIGGER_DISTANCE_PX = 250;
// A real flick produces a stream of per-frame samples; programmatic jumps
// (scroll restoration, scroll locks) arrive as 1-2 samples. Requiring 3+
// rejects them structurally.
const SCROLL_MIN_SAMPLES = 3;
// Secondary condition: user slams into the very top of the page faster than
// this — covers exits that start too close to the top to accumulate the full
// trigger distance (reaching for the address bar / tab switcher).
const TOP_SLAM_VELOCITY_PX_S = 800;
const TOP_SLAM_MIN_DISTANCE_PX = 60;
// Momentum scrolling continues after the finger lifts; samples within this
// tail still count as finger-driven.
const TOUCH_TAIL_MS = 1500;
// A confirmed tap (click) on an interactive element suppresses the scroll
// trigger briefly: smooth scroll-to-top buttons and scroll-lock open/close
// both follow a tap and would otherwise read as upward flicks.
const CLICK_SUPPRESSION_MS = 1500;

// History sentinel marker for the back-intercept (Trigger 3). Stored on the
// pushed history entry's state object.
const BACK_SENTINEL_KEY = 'storeExitIntentSentinel';

// Module-level so remounts (the detector reinstalls on every pathname change)
// don't lose gesture/suppression continuity mid-interaction.
let suppressScrollUntil = 0;
let touchActive = false;
let lastTouchEndAt = -Infinity;
// True while the CURRENT history entry is our sentinel — the next back press
// is an exit attempt.
let backSentinelArmed = false;

interface DetectorOptions {
  // Gates beyond the detector's own (cart non-empty, no stored email, etc.).
  // Returning false suppresses the popup without consuming the cooldown.
  shouldShow: () => boolean;
  cooldownMs: number; // 0 disables cooldown (test mode)
  onTrigger: () => void;
  // Trigger 3: intercept the first mobile back press with the exit-intent
  // popup. Off by default — it costs the user one extra back press, so it
  // ships behind NEXT_PUBLIC_ABANDONED_CART_BACK_INTERCEPT as an experiment.
  backIntercept?: boolean;
}

function readStr(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStr(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full or denied */
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage denied */
  }
}

function getElementFromTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function isIgnoredDesktopExitTarget(target: EventTarget | null): boolean {
  const element = getElementFromTarget(target);
  if (!element) return false;
  return Boolean(
    element.closest('select, option, input, textarea, [contenteditable="true"]'),
  );
}

function isTopViewportExit(event: MouseEvent): boolean {
  if (event.clientY > 0) return false;
  if (isIgnoredDesktopExitTarget(event.target)) return false;

  const relatedTarget = event.relatedTarget;
  if (
    relatedTarget instanceof Node &&
    document.documentElement.contains(relatedTarget)
  ) {
    return false;
  }

  return true;
}

function isIntentionalInteraction(target: EventTarget | null): boolean {
  const element = getElementFromTarget(target);
  if (!element) return false;

  const interactive = element.closest<HTMLElement>(
    'a[href], button, input, select, textarea, summary, [role="button"], [role="menuitem"], [role="tab"]',
  );
  if (!interactive) return false;

  if (interactive instanceof HTMLAnchorElement) {
    if (interactive.hasAttribute('download')) return false;
    const href = interactive.getAttribute('href');
    if (!href) return false;

    try {
      const url = new URL(interactive.href, location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Install the detector. Returns a cleanup function that removes every
 * listener. Safe to call from a useEffect.
 *
 * Does NOT undo localStorage state — the cooldown flags survive remounts on
 * purpose. Module-level gesture state also survives remounts so a pathname
 * change mid-gesture doesn't reset suppression/provenance.
 */
export function installExitIntentDetector(
  opts: DetectorOptions,
): () => void {
  if (typeof window === 'undefined') return () => {};

  LEGACY_MOBILE_BACK_KEYS.forEach(removeKey);

  let triggeredThisSession = false;
  const cleanups: Array<() => void> = [];

  // All show-gates except the commit. Shared by tryShow and the back-intercept
  // arming check (no sentinel is pushed when the popup could never show).
  const canShow = (): boolean => {
    if (triggeredThisSession) return false;
    if (!opts.shouldShow()) return false;

    if (opts.cooldownMs > 0) {
      const last = readStr(KEYS.lastShown);
      if (last) {
        const lastMs = parseInt(last, 10);
        if (Number.isFinite(lastMs) && Date.now() - lastMs < opts.cooldownMs) {
          return false;
        }
      }
    }
    return true;
  };

  // Fire the popup if all gates pass. Returns whether it actually showed.
  const tryShow = (): boolean => {
    if (!canShow()) return false;
    triggeredThisSession = true;
    if (opts.cooldownMs > 0) writeStr(KEYS.lastShown, String(Date.now()));
    opts.onTrigger();
    return true;
  };

  // ---------------------------------------------------------------
  // Trigger 1 — desktop: mouseout/mouseleave through the top edge.
  // ---------------------------------------------------------------
  const onTopMouseExit = (e: MouseEvent) => {
    if (!isTopViewportExit(e)) return;
    tryShow();
  };
  document.addEventListener('mouseout', onTopMouseExit);
  document.addEventListener('mouseleave', onTopMouseExit);
  document.documentElement.addEventListener('mouseleave', onTopMouseExit);
  cleanups.push(() => {
    document.removeEventListener('mouseout', onTopMouseExit);
    document.removeEventListener('mouseleave', onTopMouseExit);
    document.documentElement.removeEventListener('mouseleave', onTopMouseExit);
  });

  // ---------------------------------------------------------------
  // Touch provenance — shared by Triggers 2 and 3. Only finger-driven
  // scrolls count (replaces UA sniffing: iPads with desktop UAs are
  // covered, and desktop wheel/keyboard scrolling is excluded naturally).
  // ---------------------------------------------------------------
  const onTouchStart = () => {
    touchActive = true;
    armBackIntercept();
  };
  const onTouchEnd = () => {
    touchActive = false;
    lastTouchEndAt = performance.now();
  };
  document.addEventListener('touchstart', onTouchStart, {
    capture: true,
    passive: true,
  });
  document.addEventListener('touchend', onTouchEnd, {
    capture: true,
    passive: true,
  });
  document.addEventListener('touchcancel', onTouchEnd, {
    capture: true,
    passive: true,
  });
  cleanups.push(() => {
    document.removeEventListener('touchstart', onTouchStart, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    document.removeEventListener('touchcancel', onTouchEnd, true);
  });

  // A confirmed tap on a link/button (click fires only when the gesture ended
  // as a tap, never for a scroll) suppresses the scroll trigger: the tap may
  // start a smooth scroll-to-top or a scroll-lock open/close, both of which
  // look like upward flicks. NOT bound to touchstart — every scroll gesture
  // begins with a touchstart, so suppressing there killed legitimate flicks.
  const onClick = (event: Event) => {
    if (!isIntentionalInteraction(event.target)) return;
    suppressScrollUntil = performance.now() + CLICK_SUPPRESSION_MS;
  };
  document.addEventListener('click', onClick, true);
  cleanups.push(() => document.removeEventListener('click', onClick, true));

  // ---------------------------------------------------------------
  // Trigger 2 — mobile fast upward flick (windowed velocity).
  // ---------------------------------------------------------------
  let samples: Array<{ t: number; y: number }> = [];

  const onScroll = () => {
    const now = performance.now();
    const fingerDriven =
      touchActive || now - lastTouchEndAt < TOUCH_TAIL_MS;
    if (!fingerDriven || now < suppressScrollUntil) {
      samples = [];
      return;
    }

    const y = window.scrollY;
    const prev = samples[samples.length - 1];
    // Direction reset: the buffer only ever holds a continuous upward run.
    if (prev && y >= prev.y) samples = [];
    samples.push({ t: now, y });
    while (samples.length && now - samples[0].t > SCROLL_WINDOW_MS) {
      samples.shift();
    }
    if (samples.length < SCROLL_MIN_SAMPLES) return;

    const rise = samples[0].y - y;
    const span = now - samples[0].t;
    const velocity = span > 0 ? (rise / span) * 1000 : 0;
    const slammedIntoTop =
      y <= 0 &&
      rise >= TOP_SLAM_MIN_DISTANCE_PX &&
      velocity >= TOP_SLAM_VELOCITY_PX_S;

    if (rise >= SCROLL_TRIGGER_DISTANCE_PX || slammedIntoTop) {
      samples = [];
      tryShow();
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => document.removeEventListener('scroll', onScroll));

  // ---------------------------------------------------------------
  // Trigger 3 — mobile back-button intercept (env-gated experiment).
  //
  // On the first touch where the popup could show, push a same-URL sentinel
  // history entry (Next.js >=14.1 integrates native pushState with the App
  // Router). The next back press pops the sentinel — same URL, so no visible
  // navigation — and shows the popup instead of leaving. If the gates fail at
  // pop time we immediately history.back() again so the user is never trapped.
  //
  // Returning INTO the sentinel from a deeper page (e.g. back from /checkout,
  // where the detector is not installed) re-arms via the history.state check
  // below, so the FOLLOWING back press still intercepts.
  // ---------------------------------------------------------------
  function armBackIntercept(): void {
    if (!opts.backIntercept) return;
    if (backSentinelArmed) return;
    if (window.history.state?.[BACK_SENTINEL_KEY]) {
      backSentinelArmed = true;
      return;
    }
    if (!canShow()) return;
    try {
      // Spread the current state so Next's internal tree survives on the
      // cloned entry; pushed under user activation so Chrome's back/forward
      // intervention doesn't skip it.
      window.history.pushState(
        { ...(window.history.state ?? {}), [BACK_SENTINEL_KEY]: true },
        '',
        window.location.href,
      );
      backSentinelArmed = true;
    } catch {
      /* history API rate-limited or denied — skip silently */
    }
  }

  if (opts.backIntercept) {
    // Re-arm on install if the current entry is already the sentinel —
    // happens after navigating back from a skip-path page like /checkout
    // via an SPA popstate (Next.js router).
    if (window.history.state?.[BACK_SENTINEL_KEY]) backSentinelArmed = true;

    // Re-arm on bfcache restore: when the browser restores this page from the
    // back-forward cache (event.persisted === true), no remount fires, so the
    // install-time check above never runs again. The pageshow event is the only
    // signal we get for a bfcache restore — check if the current entry is still
    // the sentinel and arm accordingly.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      if (window.history.state?.[BACK_SENTINEL_KEY]) {
        backSentinelArmed = true;
      }
    };
    window.addEventListener('pageshow', onPageShow);
    cleanups.push(() => window.removeEventListener('pageshow', onPageShow));

    const onPopState = (e: PopStateEvent) => {
      if (e.state?.[BACK_SENTINEL_KEY]) {
        // Traveled back INTO the sentinel entry — the next press exits.
        backSentinelArmed = true;
        return;
      }
      if (!backSentinelArmed) return;
      backSentinelArmed = false;
      if (!tryShow()) {
        // Gates failed (cart emptied, cooldown, already shown) — continue
        // the navigation the user asked for instead of eating the press.
        window.history.back();
      }
    };
    window.addEventListener('popstate', onPopState);
    cleanups.push(() => window.removeEventListener('popstate', onPopState));
  }

  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* listener already removed */
      }
    });
  };
}

/**
 * Soft dismissal: bump the lastShown timestamp so the cooldown gates the next
 * fire. Used when the user closes the popup without submitting — we want it
 * to come back later (e.g. after returning from /checkout) instead of being
 * banned from this browser.
 */
export function snoozeExitIntentForCooldown(): void {
  writeStr(KEYS.lastShown, String(Date.now()));
}

/**
 * Wipe every localStorage key the detector owns and reset module-level
 * gesture state. Useful for test mode and for an admin "reset" affordance
 * later. Does NOT touch unrelated keys.
 */
export function clearExitIntentState(): void {
  suppressScrollUntil = 0;
  touchActive = false;
  lastTouchEndAt = -Infinity;
  backSentinelArmed = false;
  Object.values(KEYS).forEach(removeKey);
  LEGACY_MOBILE_BACK_KEYS.forEach(removeKey);
}
