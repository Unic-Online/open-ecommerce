'use client'

import { useEffect } from 'react'
import { useCart } from '@/lib/cart-context'
import { clearAppliedCoupon } from '@/lib/applied-coupon'

interface Props {
  shouldClearCheckoutState: boolean
}

export default function OrderConfirmationClientCleanup({ shouldClearCheckoutState }: Props) {
  const { clearCart } = useCart()

  useEffect(() => {
    if (!shouldClearCheckoutState) return
    clearCart()
    clearAppliedCoupon()
  }, [clearCart, shouldClearCheckoutState])

  return null
}
