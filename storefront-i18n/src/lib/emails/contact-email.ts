import { DEFAULT_MARKET, getMarketConfig, type MarketKey } from '@/i18n/market-config'

export interface ContactEmailParams {
  firstName: string
  lastName: string
  email: string
  phone: string
  subject: string
  message: string
  market?: MarketKey
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderContactEmail(params: ContactEmailParams): string {
  const { firstName, lastName, email, phone, subject, message, market = DEFAULT_MARKET } = params
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>')
  const marketConfig = getMarketConfig(market)
  const businessName = marketConfig.name
  const siteUrl = marketConfig.baseUrl
  const whatsappDisplay = marketConfig.contact.whatsappDisplay

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
        <p style="color: #8892a6; font-size: 14px; margin: 8px 0 0;">Mesaj nou din formularul de contact</p>
      </div>

      <div style="background: #0d1117; border: 1px solid #1a1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 16px; color: #e8ecf2;">📬 Subiect</h2>
        <p style="margin: 0; color: #00E5CC; font-size: 18px; font-weight: 600;">${escapeHtml(subject)}</p>
      </div>

      <div style="background: #0d1117; border: 1px solid #1a1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 16px; color: #e8ecf2;">👤 Date de contact</h2>
        <table style="font-size: 14px; color: #b0b8c8;" cellpadding="4" cellspacing="0">
          <tr><td style="color: #8892a6; padding-right: 12px;">Nume:</td><td><strong style="color: #e8ecf2;">${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong></td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Email:</td><td><a href="mailto:${escapeHtml(email)}" style="color: #00E5CC;">${escapeHtml(email)}</a></td></tr>
          <tr><td style="color: #8892a6; padding-right: 12px;">Telefon:</td><td><a href="tel:${escapeHtml(phone)}" style="color: #00E5CC;">${escapeHtml(phone)}</a></td></tr>
        </table>
      </div>

      <div style="background: #0d1117; border: 1px solid #1a1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 16px; color: #e8ecf2;">💬 Mesaj</h2>
        <div style="color: #d8dde6; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</div>
      </div>

      <div style="text-align: center; color: #8892a6; font-size: 12px; padding-top: 16px; border-top: 1px solid #1a1f2e;">
        <p>${businessName} · ${siteUrl}${whatsappDisplay ? ` · ${whatsappDisplay}` : ''}</p>
      </div>
    </div>
  </body>
  </html>`
}
