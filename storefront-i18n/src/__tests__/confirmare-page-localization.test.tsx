/**
 * The order-confirmation page rendered its entire body in hardcoded Romanian
 * on every locale of this template: titles, subtitles, "what happens next"
 * bullets, the order-number label and the contact line. On top of the
 * language leak it:
 *   - suggested "ramburs (plata la livrare)" as an alternative after a failed
 *     payment on the card-only EUR market, and
 *   - rendered a hardcoded WhatsApp number (the upstream live site's!) even
 *     though the demo market config has no WhatsApp agent
 *     (MARKETS[*].contact.whatsappNumber === '').
 *
 * Fix under test: copy moved to `common.confirmare` messages (en/ro),
 * cash-on-delivery hint gated on market.checkout.paymentMethods, WhatsApp
 * block gated on market.contact.whatsappNumber.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { createTranslator } from 'next-intl'
import { renderWithProviders } from './test-utils'
import roCommon from '../../messages/ro/common.json'
import enCommon from '../../messages/en/common.json'

const MESSAGES: Record<string, Record<string, unknown>> = {
  ro: { common: roCommon },
  en: { common: enCommon },
}

const { mockFindOrderById } = vi.hoisted(() => ({
  mockFindOrderById: vi.fn(),
}))

vi.mock('@/lib/contacts', () => ({
  findOrderById: mockFindOrderById,
  updateOrderPayment: vi.fn(),
}))

vi.mock('@/lib/revolut', () => ({
  retrieveRevolutOrder: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
      createTranslator({
        locale,
        namespace: namespace as never,
        messages: MESSAGES[locale] as never,
      }),
  ),
}))

// Client children with their own behavior/tests — irrelevant to the copy.
vi.mock('@/components/OrderConfirmationClientCleanup', () => ({ default: () => null }))
vi.mock('@/components/OrderConfirmationPurchaseTracker', () => ({ default: () => null }))
vi.mock('@/components/OrderConfirmationStatusPoller', () => ({ default: () => null }))

import ConfirmarePage from '@/app/[locale]/confirmare/[orderId]/page'

function orderDoc(status: string) {
  return {
    orderId: 'ABCD1234',
    status,
    paymentMethod: 'card',
    items: [{ id: 'furniture__aria-console', quantity: 1, unitPrice: 249, shortName: 'Aria Console' }],
    totalPrice: 234,
    currency: 'EUR',
    shippingCost: 10,
    payment: { providerOrderId: 'rev_1', currency: 'EUR' },
  }
}

async function renderConfirmare(locale: 'ro' | 'en', status: string) {
  mockFindOrderById.mockResolvedValue(orderDoc(status))
  const page = await ConfirmarePage({
    params: Promise.resolve({ orderId: 'ABCD1234', locale }),
  })
  return renderWithProviders(page, {
    locale,
    market: locale === 'en' ? 'english' : 'ro',
  })
}

type ConfirmareMessages = {
  confirmare: {
    orderNumberLabel: string
    paid: { title: string; subtitle: string }
    failed: { title: string }
  }
}

describe('order confirmation localization per market', () => {
  beforeEach(() => {
    mockFindOrderById.mockReset()
  })

  it('renders the paid confirmation in English on the EN market, without a hardcoded WhatsApp number', async () => {
    await renderConfirmare('en', 'paid')

    const en = (enCommon as unknown as ConfirmareMessages).confirmare
    expect(screen.getByText(en.paid.title)).toBeInTheDocument()
    expect(screen.getByText(en.paid.subtitle)).toBeInTheDocument()
    expect(screen.getByText(en.orderNumberLabel)).toBeInTheDocument()

    // No Romanian leak.
    expect(screen.queryByText('Plata reușită — mulțumim!')).toBeNull()
    expect(screen.queryByText('Număr comandă')).toBeNull()

    // The demo markets have no WhatsApp agent — and the upstream live site's
    // number must never render in the de-branded template.
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull()
  })

  it('does not suggest cash on delivery after a failed payment on the card-only EN market', async () => {
    await renderConfirmare('en', 'failed')

    const en = (enCommon as unknown as ConfirmareMessages).confirmare
    expect(screen.getByText(en.failed.title)).toBeInTheDocument()
    expect(screen.queryByText(/cash on delivery as an alternative/i)).toBeNull()
    expect(screen.queryByText(/ramburs/i)).toBeNull()
  })

  it('keeps the Romanian copy and the ramburs alternative on the RO market', async () => {
    await renderConfirmare('ro', 'failed')

    const ro = (roCommon as unknown as ConfirmareMessages).confirmare
    expect(screen.getByText(ro.failed.title)).toBeInTheDocument()
    expect(screen.getByText(/ramburs \(plata la livrare\)/)).toBeInTheDocument()
    // RO demo market also has no WhatsApp agent configured.
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull()
  })
})
