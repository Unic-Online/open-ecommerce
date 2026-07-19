'use client'

import { usePathname } from '@/lib/nav'
import { useEffect } from 'react'
import {
  resolveCheckoutPaymentVariantFromUrl,
  writeCheckoutPaymentVariantCookie,
} from '@/lib/ab-testing'

export default function ExperimentAssignment() {
  const pathname = usePathname()

  useEffect(() => {
    const variant = resolveCheckoutPaymentVariantFromUrl(window.location.href)
    if (variant) writeCheckoutPaymentVariantCookie(variant)
  }, [pathname])

  return null
}
