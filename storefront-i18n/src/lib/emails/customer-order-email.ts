/**
 * Customer order confirmation email — pure HTML renderer.
 *
 * White-mode design (matches account-magic-link.ts) so the body reads
 * cleanly in both client default themes.
 *
 * Caller contract:
 *   - `magicLinkUrl`, when present, renders a "View my orders" CTA that
 *     auto-authenticates the recipient. Issuer (caller) must use the
 *     long-TTL helper `issueMagicLinkForEmail` so the link is still
 *     valid days after delivery. When null the section collapses.
 */
import type { ShippingData, OrderItem, PaymentMethod } from '@/lib/validation'
import { DEFAULT_MARKET, getMarketConfig, type MarketKey } from '@/i18n/market-config'
import type { LocaleKey } from '@/i18n/locales'
import { formatMoney } from '@/lib/format'
import { getLineItemTotal, getLineItemVariantSummary } from '@/lib/line-items'

interface CustomerOrderEmailParams {
  orderId: string
  items: OrderItem[]
  shipping: ShippingData
  subtotal: number
  discount: number
  shippingCost?: number
  totalPrice: number
  paymentMethod: PaymentMethod
  market?: MarketKey
  magicLinkUrl?: string | null
}

/** Send path the subject is for: order placed (ramburs), payment confirmed
 *  (Revolut webhook), or an admin re-send of the confirmation. */
export type CustomerOrderEmailSubjectKind = 'placed' | 'paid' | 'resend'

interface Copy {
  subjects: Record<CustomerOrderEmailSubjectKind, (orderId: string) => string>
  greeting: (firstName: string) => string
  introCard: string
  introRamburs: string
  orderNumber: string
  total: string
  productsTitle: string
  product: string
  qty: string
  price: string
  subtotal: string
  welcomeDiscount: string
  shipping: string
  payment: string
  paidCard: string
  ramburs: string
  free: string
  deliveryTitle: string
  deliveryNote: string
  ctaTitle: string
  ctaButton: string
  ctaHelp: string
  questionsWhatsApp: (whatsapp: string) => string
  questionsEmail: string
}

const COPY: Record<LocaleKey, Copy> = {
  ro: {
    subjects: {
      placed: (orderId) => `Comanda ta — #${orderId}`,
      paid: (orderId) => `Mulțumim pentru comandă — #${orderId}`,
      resend: (orderId) => `Confirmare comandă #${orderId}`,
    },
    greeting: (n) => `Bună, ${n}!`,
    introCard: 'Mulțumim — am primit plata și pregătim coletul.',
    introRamburs: 'Mulțumim pentru comandă! O pregătim acum.',
    orderNumber: 'Număr comandă',
    total: 'Total',
    productsTitle: 'Produsele tale',
    product: 'Produs',
    qty: 'Cant.',
    price: 'Preț',
    subtotal: 'Subtotal',
    welcomeDiscount: 'Reducere de bun venit',
    shipping: 'Livrare',
    payment: 'Plată',
    paidCard: 'Plătită cu cardul',
    ramburs: 'Ramburs (la livrare)',
    free: 'Gratuită',
    deliveryTitle: 'Livrare',
    deliveryNote:
      'Te contactăm telefonic pentru confirmare. Livrare prin curier în 24-48 ore lucrătoare.',
    ctaTitle: 'Vezi statusul comenzii',
    ctaButton: 'Intră în contul tău',
    ctaHelp:
      'Linkul te conectează automat — nu e nevoie de parolă. O singură utilizare; păstrează emailul în siguranță.',
    questionsWhatsApp: (w) =>
      `Întrebări? Scrie-ne pe WhatsApp: <strong style="color:#c0392b;">${w}</strong>`,
    questionsEmail:
      'Întrebări? Răspunde direct la acest email — îți răspundem rapid.',
  },
  en: {
    subjects: {
      placed: (orderId) => `Your order — #${orderId}`,
      paid: (orderId) => `Thank you for your order — #${orderId}`,
      resend: (orderId) => `Order confirmation #${orderId}`,
    },
    greeting: (n) => `Hello ${n},`,
    introCard: 'Thank you — payment received and we\'re preparing your parcel.',
    introRamburs: 'Thank you for your order! We\'re getting it ready now.',
    orderNumber: 'Order number',
    total: 'Total',
    productsTitle: 'Your products',
    product: 'Product',
    qty: 'Qty',
    price: 'Price',
    subtotal: 'Subtotal',
    welcomeDiscount: 'Welcome discount',
    shipping: 'Delivery',
    payment: 'Payment',
    paidCard: 'Paid by card',
    ramburs: 'Cash on delivery',
    free: 'Free',
    deliveryTitle: 'Delivery',
    deliveryNote:
      'We\'ll call you to confirm delivery. Dispatched within 24–48 working hours.',
    ctaTitle: 'Track your order',
    ctaButton: 'Go to my account',
    ctaHelp:
      'The link signs you in automatically — no password needed. Single use only; keep this email safe.',
    questionsWhatsApp: (w) =>
      `Questions? Message us on WhatsApp: <strong style="color:#c0392b;">${w}</strong>`,
    questionsEmail:
      'Questions? Reply directly to this email — we\'ll get back to you promptly.',
  },
}

/**
 * Locale-keyed subject line for every customer order-email send path.
 * Routes MUST use this instead of inline literals — hardcoded Romanian
 * subjects reached `en` customers. Falls back to the RO copy for legacy
 * orders persisted before `locale` existed.
 */
export function customerOrderEmailSubject(
  locale: LocaleKey,
  kind: CustomerOrderEmailSubjectKind,
  orderId: string,
): string {
  const copy = COPY[locale] ?? COPY.ro
  return copy.subjects[kind](orderId)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderCustomerOrderEmail({
  orderId,
  items,
  shipping,
  subtotal,
  discount,
  shippingCost = 0,
  totalPrice,
  paymentMethod,
  market = DEFAULT_MARKET,
  magicLinkUrl,
}: CustomerOrderEmailParams): string {
  const marketConfig = getMarketConfig(market)
  const businessName = marketConfig.name
  const siteUrl = marketConfig.baseUrl
  const whatsappDisplay = marketConfig.contact.whatsappDisplay
  const locale = marketConfig.locale
  const c = COPY[locale]
  const money = (amount: number) => formatMoney(amount, marketConfig.currency, locale)

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #eee;color:#1a1d24;">
          <strong>${escapeHtml(item.productName)}</strong><br/>
          <span style="color:#6b6f78;font-size:13px;">${escapeHtml(getLineItemVariantSummary(item))}</span>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:center;color:#1a1d24;">
          ${item.quantity}
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:right;color:#c0392b;font-weight:600;">
          ${money(getLineItemTotal(item))}
        </td>
      </tr>`,
    )
    .join('')

  const paymentLabel =
    paymentMethod === 'card'
      ? `<span style="color:#1e7e34;font-weight:600;">✓ ${c.paidCard}</span>`
      : `<span style="color:#b07a00;font-weight:600;">${c.ramburs}</span>`

  const intro = paymentMethod === 'card' ? c.introCard : c.introRamburs
  const shippingLabel = shippingCost === 0 ? c.free : money(shippingCost)
  const shippingColor = shippingCost === 0 ? '#1e7e34' : '#1a1d24'
  const questionsLine = whatsappDisplay
    ? c.questionsWhatsApp(whatsappDisplay)
    : c.questionsEmail

  const ctaBlock = magicLinkUrl
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
        <tr><td>
          <h2 style="font-size:16px;margin:0 0 12px;color:#1a1d24;">${c.ctaTitle}</h2>
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr><td>
              <a href="${magicLinkUrl}" style="display:inline-block;background:#e74c3c;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;">${c.ctaButton}</a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0;font-size:13px;color:#6b6f78;">${c.ctaHelp}</p>
        </td></tr>
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.orderNumber} #${orderId}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;color:#1a1d24;font-family:Jost,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;padding:0 20px;">
        <tr><td>

          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#1a1d24;font-size:24px;font-weight:600;margin:0;">${businessName}</h1>
            <p style="color:#6b6f78;font-size:15px;margin:12px 0 0;">${c.greeting(escapeHtml(shipping.firstName))} ${intro}</p>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr>
              <td>
                <span style="color:#6b6f78;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">${c.orderNumber}</span><br/>
                <strong style="color:#1a1d24;font-size:22px;letter-spacing:0.05em;">#${orderId}</strong>
              </td>
              <td style="text-align:right;">
                <span style="color:#6b6f78;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">${c.total}</span><br/>
                <strong style="color:#c0392b;font-size:22px;">${money(totalPrice)}</strong>
              </td>
            </tr>
          </table>

          ${ctaBlock}

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr><td>
              <h2 style="font-size:16px;margin:0 0 16px;color:#1a1d24;">${c.productsTitle}</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="color:#6b6f78;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
                    <th style="text-align:left;padding:8px 14px;border-bottom:1px solid #eee;">${c.product}</th>
                    <th style="text-align:center;padding:8px 14px;border-bottom:1px solid #eee;">${c.qty}</th>
                    <th style="text-align:right;padding:8px 14px;border-bottom:1px solid #eee;">${c.price}</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>
              <table style="width:100%;margin-top:16px;padding-top:12px;border-top:1px solid #eee;font-size:14px;" cellpadding="6" cellspacing="0">
                <tr><td style="color:#6b6f78;">${c.subtotal}</td><td style="text-align:right;color:#1a1d24;">${money(subtotal)}</td></tr>
                <tr><td style="color:#6b6f78;">${c.welcomeDiscount}</td><td style="text-align:right;color:#1e7e34;">-${money(discount)}</td></tr>
                <tr><td style="color:#6b6f78;">${c.shipping}</td><td style="text-align:right;color:${shippingColor};">${shippingLabel}</td></tr>
                <tr><td style="color:#6b6f78;">${c.payment}</td><td style="text-align:right;">${paymentLabel}</td></tr>
                <tr><td style="font-size:16px;font-weight:700;color:#1a1d24;padding-top:8px;">${c.total}</td><td style="text-align:right;font-size:18px;font-weight:700;color:#c0392b;padding-top:8px;">${money(totalPrice)}</td></tr>
              </table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr><td>
              <h2 style="font-size:16px;margin:0 0 16px;color:#1a1d24;">${c.deliveryTitle}</h2>
              <p style="margin:0 0 8px;color:#1a1d24;font-size:14px;line-height:1.55;">
                ${escapeHtml(shipping.firstName)} ${escapeHtml(shipping.lastName)}<br/>
                ${escapeHtml(shipping.address)}<br/>
                ${escapeHtml(shipping.city)}, ${escapeHtml(shipping.county)}<br/>
                ${escapeHtml(shipping.country)}${shipping.postalCode ? `, ${escapeHtml(shipping.postalCode)}` : ''}<br/>
                ${escapeHtml(shipping.phone)}
              </p>
              <p style="margin:14px 0 0;color:#6b6f78;font-size:13px;">${c.deliveryNote}</p>
            </td></tr>
          </table>

          <div style="text-align:center;color:#6b6f78;font-size:13px;padding-top:12px;border-top:1px solid #e8e8e8;">
            <p style="margin:0 0 8px;">${questionsLine}</p>
            <p style="margin:0;">${businessName} · <a href="${siteUrl}" style="color:#c0392b;text-decoration:none;">${siteUrl.replace('https://', '')}</a></p>
          </div>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
