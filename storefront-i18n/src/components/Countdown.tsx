'use client'

import { Fragment, useMemo, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import styles from './Countdown.module.css'

interface CountdownProps {
  targetDate: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calcTimeLeft(targetDate: string, now: number): TimeLeft {
  const diff = new Date(targetDate).getTime() - now
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

// The wall clock is an external store: subscribe re-renders once a second,
// the snapshot is floored to the second so it is referentially stable
// between ticks, and the server snapshot is null (rendered as '--').
function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000)
  return () => clearInterval(id)
}
function getClockSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000
}
function getClockServerSnapshot(): number | null {
  return null
}

export default function Countdown({ targetDate }: CountdownProps) {
  const t = useTranslations('common.countdown')
  const now = useSyncExternalStore<number | null>(
    subscribeToClock,
    getClockSnapshot,
    getClockServerSnapshot,
  )

  const timeLeft = useMemo(
    () => (now !== null ? calcTimeLeft(targetDate, now) : null),
    [targetDate, now],
  )

  const pad = (n: number) => String(n).padStart(2, '0')

  const items = [
    { value: timeLeft?.days ?? 0, label: t('days') },
    { value: timeLeft?.hours ?? 0, label: t('hours') },
    { value: timeLeft?.minutes ?? 0, label: t('minutes') },
    { value: timeLeft?.seconds ?? 0, label: t('seconds') },
  ]

  return (
    <div className={styles.countdown} role="timer" aria-live="polite" suppressHydrationWarning>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          <div className={styles.box}>
            <span className={styles.value} suppressHydrationWarning>
              {timeLeft ? pad(item.value) : '--'}
            </span>
            <span className={styles.label}>{item.label}</span>
          </div>
          {i < items.length - 1 && (
            <span className={styles.sep} aria-hidden="true">
              :
            </span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
