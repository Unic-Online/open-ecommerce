/**
 * Shipment dispatch email — sent when an admin marks an order as shipped
 * with a tracking number. Idempotency is enforced upstream by
 * `setFulfillment` / `markShipmentEmailSent`; this module is pure rendering.
 *
 * Invariants:
 *   - Locale + market come from the ORDER, not the request. The admin host
 *     is irrelevant to what the customer reads.
 *   - Sender (`from`) is `marketConfig.contact.fromEmail` for the order's
 *     market. Subject is locale-aware.
 *   - Tracking number is plain-text only — we do not auto-link to carrier
 *     sites because operator-provided values are not validated.
 *   - White-mode design (matches customer-order-email.ts and
 *     account-magic-link.ts) so the body reads cleanly across clients.
 *   - `magicLinkUrl`, when present, embeds a one-shot account login CTA.
 *     Same trust model as the order email's link (single-use, ~no expiry).
 */
import type { OrderDoc } from '@/lib/orders/types';
import { getMarketConfig } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';
import { formatMoney } from '@/lib/format';

interface Copy {
  subject: (orderId: string) => string;
  greeting: (firstName: string) => string;
  intro: string;
  trackingTitle: string;
  carrierLabel: string;
  trackingLabel: string;
  noTracking: string;
  shipsToTitle: string;
  itemsTitle: string;
  qty: string;
  price: string;
  total: string;
  ctaTitle: string;
  ctaButton: string;
  ctaHelp: string;
  closing: string;
}

const COPY: Record<LocaleKey, Copy> = {
  ro: {
    subject: (orderId) => `Comanda ta a fost expediată — #${orderId}`,
    greeting: (n) => `Bună, ${n}!`,
    intro: 'Comanda ta a plecat din depozit. Iată detaliile expedierii:',
    trackingTitle: 'Expediere',
    carrierLabel: 'Curier',
    trackingLabel: 'AWB',
    noTracking: 'Numărul AWB îți va fi comunicat în scurt timp.',
    shipsToTitle: 'Adresă de livrare',
    itemsTitle: 'Produsele expediate',
    qty: 'Cant.',
    price: 'Preț',
    total: 'Total comandă',
    ctaTitle: 'Vezi statusul comenzii',
    ctaButton: 'Intră în contul tău',
    ctaHelp:
      'Linkul te conectează automat — nu e nevoie de parolă. O singură utilizare; păstrează emailul în siguranță.',
    closing:
      'Curierul te va contacta înainte de livrare. Pentru orice întrebare, răspunde la acest email.',
  },
  en: {
    subject: (orderId) => `Your order has been dispatched — #${orderId}`,
    greeting: (n) => `Hello ${n},`,
    intro: 'Your order has left our warehouse. Here are your dispatch details:',
    trackingTitle: 'Dispatch',
    carrierLabel: 'Carrier',
    trackingLabel: 'Tracking number',
    noTracking: 'Your tracking number will be sent to you shortly.',
    shipsToTitle: 'Delivery address',
    itemsTitle: 'Items dispatched',
    qty: 'Qty',
    price: 'Price',
    total: 'Order total',
    ctaTitle: 'Track your order',
    ctaButton: 'Go to my account',
    ctaHelp:
      'The link signs you in automatically — no password needed. Single use only; keep this email safe.',
    closing:
      'The carrier will contact you before delivery. For any questions, reply to this email.',
  },
};

export function shipmentEmailSubject(order: OrderDoc): string {
  return COPY[order.locale].subject(order.orderId);
}

export function renderShipmentEmail({
  order,
  magicLinkUrl,
}: {
  order: OrderDoc;
  magicLinkUrl?: string | null;
}): string {
  const marketConfig = getMarketConfig(order.market);
  const c = COPY[order.locale];
  const money = (n: number) => formatMoney(n, order.currency, order.locale);

  const tracking = order.fulfillment?.trackingNumber?.trim();
  const carrier = order.fulfillment?.carrier?.trim();
  const shipping = order.shipping;
  const shipTo =
    shipping.useAltShipping && shipping.altAddress
      ? {
          address: shipping.altAddress,
          city: shipping.altCity ?? '',
          county: shipping.altCounty ?? '',
          postalCode: shipping.altPostalCode ?? '',
          country: shipping.altCountry ?? '',
        }
      : {
          address: shipping.address,
          city: shipping.city,
          county: shipping.county,
          postalCode: shipping.postalCode,
          country: shipping.country,
        };

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #eee;color:#1a1d24;">
          <strong>${escapeHtml(item.productName)}</strong>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:center;color:#1a1d24;">
          ${item.quantity}
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:right;color:#c0392b;font-weight:600;">
          ${money(item.unitPrice * item.quantity)}
        </td>
      </tr>`,
    )
    .join('');

  const trackingBlock = tracking
    ? `
        <table style="width:100%;font-size:14px;" cellpadding="6" cellspacing="0">
          ${
            carrier
              ? `<tr><td style="color:#6b6f78;">${c.carrierLabel}</td><td style="text-align:right;color:#1a1d24;">${escapeHtml(carrier)}</td></tr>`
              : ''
          }
          <tr><td style="color:#6b6f78;">${c.trackingLabel}</td><td style="text-align:right;color:#c0392b;font-family:'SF Mono',Menlo,monospace;">${escapeHtml(tracking)}</td></tr>
        </table>`
    : `<p style="margin:0;color:#6b6f78;font-size:13px;">${c.noTracking}</p>`;

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
    : '';

  return `<!DOCTYPE html>
<html lang="${order.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${shipmentEmailSubject(order)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;color:#1a1d24;font-family:Jost,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;padding:0 20px;">
        <tr><td>

          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#1a1d24;font-size:24px;font-weight:600;margin:0;">${escapeHtml(marketConfig.name)}</h1>
            <p style="color:#6b6f78;font-size:15px;margin:12px 0 0;">${c.greeting(escapeHtml(shipping.firstName))} ${c.intro}</p>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr><td>
              <h2 style="font-size:16px;margin:0 0 16px;color:#1a1d24;">${c.trackingTitle} — #${order.orderId}</h2>
              ${trackingBlock}
            </td></tr>
          </table>

          ${ctaBlock}

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr><td>
              <h2 style="font-size:16px;margin:0 0 16px;color:#1a1d24;">${c.shipsToTitle}</h2>
              <p style="margin:0;color:#1a1d24;font-size:14px;line-height:1.55;">
                ${escapeHtml(shipping.firstName)} ${escapeHtml(shipping.lastName)}<br/>
                ${escapeHtml(shipTo.address)}<br/>
                ${escapeHtml(shipTo.city)}, ${escapeHtml(shipTo.county)}<br/>
                ${escapeHtml(shipTo.country)}${shipTo.postalCode ? `, ${escapeHtml(shipTo.postalCode)}` : ''}<br/>
                ${escapeHtml(shipping.phone)}
              </p>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr><td>
              <h2 style="font-size:16px;margin:0 0 16px;color:#1a1d24;">${c.itemsTitle}</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="color:#6b6f78;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
                    <th style="text-align:left;padding:8px 14px;border-bottom:1px solid #eee;">${c.itemsTitle}</th>
                    <th style="text-align:center;padding:8px 14px;border-bottom:1px solid #eee;">${c.qty}</th>
                    <th style="text-align:right;padding:8px 14px;border-bottom:1px solid #eee;">${c.price}</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>
              <table style="width:100%;margin-top:12px;padding-top:8px;border-top:1px solid #eee;font-size:14px;" cellpadding="6" cellspacing="0">
                <tr>
                  <td style="font-weight:700;color:#1a1d24;">${c.total}</td>
                  <td style="text-align:right;font-weight:700;color:#c0392b;">${money(order.totalPrice)}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <div style="text-align:center;color:#6b6f78;font-size:13px;padding-top:12px;border-top:1px solid #e8e8e8;">
            <p style="margin:0 0 8px;">${c.closing}</p>
            <p style="margin:0;">${escapeHtml(marketConfig.name)} · <a href="${marketConfig.baseUrl}" style="color:#c0392b;text-decoration:none;">${marketConfig.baseUrl.replace('https://', '')}</a></p>
          </div>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
