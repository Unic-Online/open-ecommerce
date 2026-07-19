import { redirect } from 'next/navigation'
import { findOrderByProviderPublicId } from '@/lib/contacts'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ result: string }>
  searchParams: Promise<{ _rp_oid?: string | string[] }>
}

const ALLOWED_RESULTS = new Set(['success', 'failure', 'cancel'])

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0]
  }
  return null
}

export default async function RevolutPayReturnPage({ params, searchParams }: PageProps) {
  const [{ result }, query] = await Promise.all([params, searchParams])
  const publicId = firstParam(query._rp_oid)

  if (!ALLOWED_RESULTS.has(result) || !publicId) {
    redirect('/checkout')
  }

  try {
    const order = await findOrderByProviderPublicId(publicId)
    if (order && typeof order.orderId === 'string' && order.orderId.trim()) {
      redirect(`/confirmare/${order.orderId}`)
    }
  } catch (err) {
    console.error('[revolut-return] failed to resolve public order id:', err)
  }

  redirect('/checkout')
}
