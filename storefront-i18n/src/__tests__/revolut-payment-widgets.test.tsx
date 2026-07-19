import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from './test-utils'
import type { ComponentProps } from 'react'

const {
  mockClearCart,
  mockPayments,
  mockRevolutPayMount,
  mockRevolutPayOn,
  mockPaymentRequest,
  mockPaymentRequestCanMakePayment,
  mockPaymentRequestRender,
  mockPaymentRequestDestroy,
  mockCreateCardField,
  mockCardFieldSubmit,
  mockCardFieldDestroy,
  mockRevolutCheckout,
} = vi.hoisted(() => ({
  __env: (() => {
    vi.stubEnv('NEXT_PUBLIC_REVOLUT_PUBLIC_KEY', 'pk_test_public_key')
    vi.stubEnv('NEXT_PUBLIC_REVOLUT_API_MODE', 'sandbox')
    return true
  })(),
  mockClearCart: vi.fn(),
  mockPayments: vi.fn(),
  mockRevolutPayMount: vi.fn(),
  mockRevolutPayOn: vi.fn(),
  mockPaymentRequest: vi.fn(),
  mockPaymentRequestCanMakePayment: vi.fn().mockResolvedValue(null),
  mockPaymentRequestRender: vi.fn(),
  mockPaymentRequestDestroy: vi.fn(),
  mockCreateCardField: vi.fn(),
  mockCardFieldSubmit: vi.fn(),
  mockCardFieldDestroy: vi.fn(),
  mockRevolutCheckout: vi.fn(),
}))

vi.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    clearCart: mockClearCart,
  }),
}))

vi.mock('@revolut/checkout', () => {
  const defaultExport = Object.assign(
    mockRevolutCheckout.mockImplementation(async () => ({
      createCardField: mockCreateCardField.mockImplementation(() => ({
        submit: mockCardFieldSubmit,
        destroy: mockCardFieldDestroy,
      })),
    })),
    {
      payments: mockPayments.mockImplementation(async () => ({
        revolutPay: {
          mount: mockRevolutPayMount,
          on: mockRevolutPayOn,
          destroy: vi.fn(),
        },
        paymentRequest: mockPaymentRequest.mockImplementation(() => ({
          canMakePayment: mockPaymentRequestCanMakePayment,
          render: mockPaymentRequestRender,
          destroy: mockPaymentRequestDestroy,
        })),
        destroy: vi.fn(),
      })),
    }
  )

  return { default: defaultExport }
})

import { RevolutPaymentWidgets } from '@/components/RevolutPaymentWidgets'

type WidgetProps = ComponentProps<typeof RevolutPaymentWidgets>

function makeProps(overrides?: Partial<WidgetProps>): WidgetProps {
  return {
    shipping: {
      firstName: 'Ion',
      lastName: 'Popescu',
      email: 'ion@test.ro',
      phone: '+40712345678',
      county: 'Ilfov',
      city: 'București',
      address: 'Str. Test nr. 10',
      country: 'România',
      postalCode: '012345',
      billingType: 'individual',
      useAltShipping: false,
    },
    shippingValid: true,
    items: [
      {
        id: 'furniture__oslo-nightstand',
        productType: 'furniture',
        productName: 'Oslo Nightstand',
        slug: 'oslo-nightstand',
        shortName: 'Oslo Nightstand',
        quantity: 1,
        unitPrice: 1899,
      },
    ],
    onSuccess: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
}

describe('RevolutPaymentWidgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderId: 'ABCD1234',
        publicId: 'public_order_token_123',
      }),
    }) as unknown as typeof fetch
  })

  it('keeps wallet buttons disabled until shipping is valid', async () => {
    const props = makeProps({ shippingValid: false })
    const { rerender } = render(<RevolutPaymentWidgets {...props} />)

    expect(
      screen.getByText(/completează adresa de livrare pentru a activa revolut pay/i)
    ).toBeInTheDocument()
    expect(mockPayments).not.toHaveBeenCalled()

    rerender(<RevolutPaymentWidgets {...makeProps()} />)

    await waitFor(() => {
      expect(mockPayments).toHaveBeenCalledTimes(1)
      expect(mockRevolutPayMount).toHaveBeenCalledTimes(1)
    })
  })

  it('does not create a card order on mount when shipping is invalid', async () => {
    render(<RevolutPaymentWidgets {...makeProps({ shippingValid: false })} />)

    // Give any pending effects a chance to run.
    await new Promise((r) => setTimeout(r, 0))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockCreateCardField).not.toHaveBeenCalled()
  })

  it('does not create a card order on mount even when shipping is valid (#14)', async () => {
    // Why: regression guard for ISSUES.md #14. The pre-fix widget mounted a
    // card session in a useEffect on every shippingValid flip, minting phantom
    // pending_payment orders for everyone who reached the payment step.
    render(<RevolutPaymentWidgets {...makeProps()} />)

    await new Promise((r) => setTimeout(r, 0))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockCreateCardField).not.toHaveBeenCalled()

    // The CTA exists, waiting for the user to click it.
    expect(
      screen.getByRole('button', { name: /plătește 1.709\s+ron cu cardul/i })
    ).toBeInTheDocument()
  })

  it('creates the card session only after the explicit Plătește cu cardul click', async () => {
    render(<RevolutPaymentWidgets {...makeProps()} />)

    fireEvent.click(
      screen.getByRole('button', { name: /plătește 1.709\s+ron cu cardul/i }),
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(mockRevolutCheckout).toHaveBeenCalledWith('public_order_token_123', 'sandbox')
      expect(mockCreateCardField).toHaveBeenCalledTimes(1)
    })
  })

  it('configures Revolut Pay for validated mobile redirects', async () => {
    render(<RevolutPaymentWidgets {...makeProps()} />)

    await waitFor(() => {
      expect(mockRevolutPayMount).toHaveBeenCalledTimes(1)
    })

    const [, options] = mockRevolutPayMount.mock.calls[0]
    expect(options).toMatchObject({
      mobileRedirectUrls: {
        success: 'https://ro.shop.example.com/revolut-pay/return/success',
        failure: 'https://ro.shop.example.com/revolut-pay/return/failure',
        cancel: 'https://ro.shop.example.com/revolut-pay/return/cancel',
      },
      customer: {
        name: 'Ion Popescu',
        email: 'ion@test.ro',
        phone: '+40712345678',
      },
    })
    await expect(options.validate()).resolves.toBe(true)

    expect(mockPaymentRequest).toHaveBeenCalledTimes(1)
  })

  it('invalidates the card session when checkout data changes after preparation', async () => {
    const props = makeProps()
    const { rerender } = render(<RevolutPaymentWidgets {...props} />)

    // Manually prepare the session — auto-prepare is gone (#14).
    fireEvent.click(
      screen.getByRole('button', { name: /plătește 1.709\s+ron cu cardul/i }),
    )
    await waitFor(() => {
      expect(mockCreateCardField).toHaveBeenCalledTimes(1)
    })

    rerender(
      <RevolutPaymentWidgets
        {...props}
        shipping={{
          ...props.shipping,
          city: 'Cluj-Napoca',
        }}
      />,
    )

    // Stale session is torn down — `cardState` returns to 'idle', no fresh
    // POST happens until the user clicks again. Confirms we no longer create
    // phantom orders just because the customer edits shipping mid-flow.
    await waitFor(() => {
      expect(mockCardFieldDestroy).toHaveBeenCalled()
    })
    expect(mockCreateCardField).toHaveBeenCalledTimes(1)
  })
})
