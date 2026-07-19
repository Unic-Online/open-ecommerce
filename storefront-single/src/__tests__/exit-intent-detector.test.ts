import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearExitIntentState,
  installExitIntentDetector,
} from '@/plugins/abandoned-cart/client/exit-intent-detector'

// These tests model REAL browser event streams: mobile scroll events fire
// once per display frame, so a flick is a series of small per-frame deltas —
// never one giant jump. The old detector compared consecutive events (a
// refresh-rate-dependent measure that made triggering impossible on 120Hz
// screens); these streams pin the windowed redesign against 60Hz and 120Hz
// alike.

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    value,
    configurable: true,
  })
}

function fireScroll(y: number) {
  setScrollY(y)
  document.dispatchEvent(new Event('scroll'))
}

function touchStart(target: EventTarget = document.body) {
  target.dispatchEvent(new Event('touchstart', { bubbles: true }))
}

function touchEnd(target: EventTarget = document.body) {
  target.dispatchEvent(new Event('touchend', { bubbles: true }))
}

function clickOn(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** Per-frame upward scroll stream: `frames` events of `step` px every `frameMs`. */
function flickUp(fromY: number, step: number, frames: number, frameMs: number) {
  let y = fromY
  fireScroll(y)
  for (let i = 0; i < frames; i++) {
    vi.advanceTimersByTime(frameMs)
    y = Math.max(0, y - step)
    fireScroll(y)
  }
}

describe('exit-intent detector — mobile scroll trigger', () => {
  let onTrigger: ReturnType<typeof vi.fn<() => void>>
  let cleanup: () => void
  let shouldShow: boolean

  function install(opts: { backIntercept?: boolean } = {}) {
    cleanup = installExitIntentDetector({
      shouldShow: () => shouldShow,
      cooldownMs: 0,
      onTrigger,
      ...opts,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    })
    localStorage.clear()
    clearExitIntentState()
    window.history.replaceState(null, document.title, '/')
    setScrollY(0)
    onTrigger = vi.fn<() => void>()
    shouldShow = true
    cleanup = () => {}
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('fires on a fast upward flick at 60Hz (~5000px/s)', () => {
    install()
    touchStart()
    flickUp(900, 80, 6, 16)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('fires on the same flick at 120Hz (half the per-frame delta)', () => {
    install()
    touchStart()
    flickUp(900, 40, 10, 8)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('keeps firing during the momentum tail after the finger lifts', () => {
    install()
    touchStart()
    touchEnd()
    vi.advanceTimersByTime(300) // still inside the 1.5s momentum tail
    flickUp(900, 80, 6, 16)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('ignores a slow reading scroll upward', () => {
    install()
    touchStart()
    // ~300px/s — far below flick velocity; window never accumulates 250px.
    flickUp(900, 5, 60, 16)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('ignores fast upward motion with no touch provenance (wheel/programmatic)', () => {
    install()
    flickUp(900, 80, 6, 16)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('ignores a single-event programmatic jump (scroll restoration / scroll lock)', () => {
    install()
    touchStart()
    fireScroll(900)
    vi.advanceTimersByTime(16)
    fireScroll(0) // one giant delta — 2 samples < the 3-sample minimum
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('is suppressed by a confirmed tap on a link (smooth scroll-to-top case)', () => {
    const link = document.createElement('a')
    link.href = '/furniture/oslo-nightstand'
    document.body.appendChild(link)
    install()

    touchStart(link)
    touchEnd(link)
    clickOn(link)
    // Smooth scroll-to-top animation right after the tap — must not fire.
    flickUp(900, 80, 6, 16)
    expect(onTrigger).not.toHaveBeenCalled()
    link.remove()
  })

  it('is suppressed by a confirmed tap on a button (cart-lock open/close case)', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    install()

    touchStart(button)
    touchEnd(button)
    clickOn(button)
    flickUp(900, 80, 6, 16)
    expect(onTrigger).not.toHaveBeenCalled()
    button.remove()
  })

  it('recovers after the tap suppression expires', () => {
    const link = document.createElement('a')
    link.href = '/furniture/oslo-nightstand'
    document.body.appendChild(link)
    install()

    clickOn(link)
    vi.advanceTimersByTime(1600) // past CLICK_SUPPRESSION_MS
    touchStart()
    flickUp(900, 80, 6, 16)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    link.remove()
  })

  it('fires when slamming into the top of the page from a short distance', () => {
    install()
    touchStart()
    // 200px in ~48ms (~4100px/s) ending at y=0 — under the 250px distance
    // bar but qualifies via the top-slam condition.
    fireScroll(200)
    vi.advanceTimersByTime(16)
    fireScroll(120)
    vi.advanceTimersByTime(16)
    fireScroll(50)
    vi.advanceTimersByTime(16)
    fireScroll(0)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('resets accumulation when the direction flips', () => {
    install()
    touchStart()
    fireScroll(900)
    vi.advanceTimersByTime(16)
    fireScroll(760)
    vi.advanceTimersByTime(16)
    fireScroll(800) // downward — buffer resets
    vi.advanceTimersByTime(16)
    fireScroll(660)
    vi.advanceTimersByTime(16)
    fireScroll(560) // only 240px since the reset, across 3 samples
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('respects the shouldShow gate', () => {
    shouldShow = false
    install()
    touchStart()
    flickUp(900, 80, 6, 16)
    expect(onTrigger).not.toHaveBeenCalled()
  })
})

describe('exit-intent detector — back-intercept (Trigger 3)', () => {
  let onTrigger: ReturnType<typeof vi.fn<() => void>>
  let cleanup: () => void
  let shouldShow: boolean

  function install(opts: { backIntercept?: boolean } = {}) {
    cleanup = installExitIntentDetector({
      shouldShow: () => shouldShow,
      cooldownMs: 0,
      onTrigger,
      ...opts,
    })
  }

  function popStateTo(state: unknown) {
    window.dispatchEvent(new PopStateEvent('popstate', { state }))
  }

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    })
    localStorage.clear()
    clearExitIntentState()
    window.history.replaceState(null, document.title, '/')
    setScrollY(0)
    onTrigger = vi.fn<() => void>()
    shouldShow = true
    cleanup = () => {}
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('does not touch history when the flag is off', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    install({ backIntercept: false })
    document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
    popStateTo(null)
    expect(pushSpy).not.toHaveBeenCalled()
    expect(onTrigger).not.toHaveBeenCalled()
    pushSpy.mockRestore()
  })

  it('arms a same-URL sentinel on first touch and shows the popup on back', () => {
    install({ backIntercept: true })
    document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
    expect(window.history.state?.storeExitIntentSentinel).toBe(true)

    // Hardware back pops the sentinel → popstate carries the PREVIOUS state.
    popStateTo(null)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('does not arm while the popup could not show (empty cart, cooldown)', () => {
    shouldShow = false
    const pushSpy = vi.spyOn(window.history, 'pushState')
    install({ backIntercept: true })
    document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
    expect(pushSpy).not.toHaveBeenCalled()
    pushSpy.mockRestore()
  })

  it('continues the navigation instead of trapping when gates fail at pop time', () => {
    install({ backIntercept: true })
    document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
    expect(window.history.state?.storeExitIntentSentinel).toBe(true)

    shouldShow = false // cart emptied between arming and the back press
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    popStateTo(null)
    expect(onTrigger).not.toHaveBeenCalled()
    expect(backSpy).toHaveBeenCalledTimes(1)
    backSpy.mockRestore()
  })

  it('re-arms when traveling back INTO the sentinel entry (back from /checkout)', () => {
    install({ backIntercept: true })
    // Back from a deeper page lands on the sentinel entry first…
    popStateTo({ storeExitIntentSentinel: true })
    expect(onTrigger).not.toHaveBeenCalled()
    // …and the FOLLOWING back press is the exit attempt.
    popStateTo(null)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('re-arms at install time when the current entry is already the sentinel', () => {
    // Simulates the detector reinstalling after a route change back from a
    // skip-path page (/checkout) where no listener was active.
    window.history.replaceState(
      { storeExitIntentSentinel: true },
      document.title,
      '/',
    )
    install({ backIntercept: true })
    popStateTo(null)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('arms only once even across many touches', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    install({ backIntercept: true })
    for (let i = 0; i < 5; i++) {
      document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
    }
    expect(pushSpy).toHaveBeenCalledTimes(1)
    pushSpy.mockRestore()
  })
})
