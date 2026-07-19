import type { ShippingData, OrderItem, PaymentMethod } from '@/lib/validation'
import { DEFAULT_MARKET, getMarketConfig, type MarketKey } from '@/i18n/market-config'
import { formatMoney } from '@/lib/format'
import { getLineItemTotal, getMerchantLineItemVariantSummary } from '@/lib/line-items'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface OrderEmailParams {
  orderId: string
  items: OrderItem[]
  shipping: ShippingData
  shippingCost?: number
  totalPrice: number
  paymentMethod?: PaymentMethod
  market?: MarketKey
}

export function renderOrderEmail({
  orderId,
  items,
  shipping,
  shippingCost = 0,
  totalPrice,
  paymentMethod = 'ramburs',
  market = DEFAULT_MARKET,
}: OrderEmailParams): string {
  const marketConfig = getMarketConfig(market)
  const businessName = marketConfig.name
  const siteUrl = marketConfig.baseUrl
  const whatsappDisplay = marketConfig.contact.whatsappDisplay
  // Merchant copy stays Romanian by design, but the MONEY must follow the
  // order's market — a EUR order rendered through the legacy RO-only
  // formatPrice reached the merchant inbox as "<n> RON".
  const money = (amount: number) => formatMoney(amount, marketConfig.currency, marketConfig.locale)
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1a1f2e;">
          <strong>${escapeHtml(item.productName)}</strong><br/>
          <span style="color: #8892a6; font-size: 13px;">
            ${escapeHtml(getMerchantLineItemVariantSummary(item))}
          </span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1a1f2e; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1a1f2e; text-align: right; color: #00E5CC; font-weight: 600;">
          ${money(getLineItemTotal(item))}
        </td>
      </tr>`
    )
    .join('')

  const paymentLabel = paymentMethod === 'card'
    ? '<strong style="color: #39FF88;">Card (Revolut) — plătită ✓</strong>'
    : '<strong style="color: #fbbf24;">Ramburs (la livrare)</strong>'
  const shippingLabel = shippingCost === 0 ? 'Gratuită' : money(shippingCost)
  const shippingColor = shippingCost === 0 ? '#39FF88' : '#e8ecf2'

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 0; background: #040810; color: #e8ecf2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;">

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #00E5CC; font-size: 28px; margin: 0;">✦ ${businessName}</h1>
        <p style="color: #8892a6; font-size: 14px; margin: 8px 0 0;">Comandă nouă primită</p>
      </div>

      <div style="background: #0d1117; border: 1px solid #1a1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <table style="width: 100%;" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="color: #8892a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Număr comandă</span><br/>
              <strong style="color: #00E5CC; font-size: 24px; letter-spacing: 0.05em;">#${orderId}</strong>
            </td>
            <td style="text-align: right;">
              <span style="color: #8892a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Total</span><br/>
              <strong style="color: #00E5CC; font-size: 24px;">${money(totalPrice)}</strong>
            </td>
          </tr>
        </table>
      </div>

      <div style="background: #0d1117; border: 1px solid #1a1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 16px; color: #e8ecf2;">📦 Produse comandate</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;" cellpadding="0" cellspacing="0">
          <thead>
            <tr style="color: #8892a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
              <th style="text-align: left; padding: 8px 12px; border-bottom: 1px solid #1a1f2e;">Produs</th>
              <th style="text-align: center; padding: 8px 12px; border-bottom: 1px solid #1a1f2e;">Cant.</th>
              <th style="text-align: right; padding: 8px 12px; border-bottom: 1px solid #1a1f2e;">Preț</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="text-align: right; margin-top: 16px; padding-top: 12px; border-top: 1px solid #1a1f2e;">
          <span style="color: #8892a6; font-size: 13px;">Livrare: </span>
          <span style="color: ${shippingColor}; font-weight: 600;">${shippingLabel}</span>
          <br/>
          <span style="font-size: 18px; font-weight: 700; color: #00E5CC;">Total: ${money(totalPrice)}</span>
        </div>
      </div>

      <div style="background: #0d1117; border: 1px solid #1a1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 16px; color: #e8ecf2;">🚚 Adresa de livrare</h2>
        <table style="font-size: 14px; color: #b0b8c8;" cellpadding="4" cellspacing="0">
          <tr><td style="color: #8892a6; padding-right: 12px;">Nume:</td><td><strong style="color: #e8ecf2;">${escapeHtml(shipping.firstName)} ${escapeHtml(shipping.lastName)}</strong></td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Email:</td><td>${escapeHtml(shipping.email)}</td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Telefon:</td><td>${escapeHtml(shipping.phone)}</td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Adresă:</td><td>${escapeHtml(shipping.address)}</td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Oraș:</td><td>${escapeHtml(shipping.city)}, ${escapeHtml(shipping.county)}</td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Țară:</td><td>${escapeHtml(shipping.country)}${shipping.postalCode ? `, ${escapeHtml(shipping.postalCode)}` : ''}</td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Plata:</td><td>${paymentLabel}</td></tr>
        </table>
      </div>

      <div style="text-align: center; color: #8892a6; font-size: 12px; padding-top: 16px; border-top: 1px solid #1a1f2e;">
        <p>${businessName} · ${siteUrl}${whatsappDisplay ? ` · ${whatsappDisplay}` : ''}</p>
      </div>
    </div>
  </body>
  </html>`
}
