import { getMarketConfig } from '@/lib/market';
import { formatMoney } from '@/lib/format';
import type { CartItemData } from '@/lib/types';

interface RecoveryEmailParams {
  recoveryUrl: string;
  items: CartItemData[];
  firstName?: string;
  couponCode?: string;
  couponDiscountPercent?: number;
}

export interface RecoveryEmail {
  subject: string;
  html: string;
}

interface Copy {
  // H1
  h1Subject: string;
  h1Title: string;
  h1Preheader: string;
  h1Greeting: (firstName: string | undefined) => string;
  h1Body: string;
  h1Cta: string;
  // H24
  h24Subject: (percent: number) => string;
  h24Title: string;
  h24Preheader: (code: string) => string;
  h24Greeting: (firstName: string | undefined) => string;
  h24Body: string;
  h24CouponEyebrow: string;
  h24CouponDescription: (percent: number) => string;
  h24Cta: string;
  // H72
  h72Subject: string;
  h72Title: string;
  h72Preheader: string;
  h72Body: string;
  h72CouponEyebrow: string;
  h72CouponDescription: (percent: number) => string;
  h72Cta: string;
  // Footer
  footerHelpEmail: string;
  footerHelpWhatsapp: (whatsapp: string) => string;
}

const COPY: Copy = {
  h1Subject: 'Did you forget something in your basket?',
  h1Title: 'Your basket is waiting',
  h1Preheader: 'Your basket is ready — one click to pick up where you left off.',
  h1Greeting: (n) => (n ? `Hello ${n},` : 'Hello!'),
  h1Body:
    "You left something in your basket and we thought you might not want to lose it. We've saved your selection — one click and you're straight back to checkout.",
  h1Cta: 'Continue my order →',
  h24Subject: (p) => `${p}% discount code, just for you`,
  h24Title: 'An exclusive offer for your basket',
  h24Preheader: (code) =>
    `Code ${code} valid for 7 days, on top of your welcome discount.`,
  h24Greeting: (n) => (n ? `${n},` : 'Hello!'),
  h24Body:
    "Your basket is still there. So you don't miss out on your selection, here's a code that stacks on top of your welcome discount:",
  h24CouponEyebrow: 'Your exclusive code',
  h24CouponDescription: (p) => `${p}% extra at checkout. Valid for 7 days.`,
  h24Cta: 'Use the code →',
  h72Subject: 'Last chance to use your discount',
  h72Title: 'Your code expires soon',
  h72Preheader: 'Final reminder — your code expires soon.',
  h72Body:
    "Sorry to see you go. This is the last time we'll remind you about your basket. Your code is still valid — use it before it expires:",
  h72CouponEyebrow: 'Final days',
  h72CouponDescription: (p) => `+${p}% on top of your welcome discount. Code expires soon.`,
  h72Cta: 'Recover my basket →',
  footerHelpEmail: "Questions? Reply to this email — we'll get back to you promptly.",
  footerHelpWhatsapp: (w) =>
    `Questions? Reply to this email or message us on WhatsApp at ${w}.`,
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemRowsHtml(items: CartItemData[]): string {
  const config = getMarketConfig();
  const money = (n: number) => formatMoney(n, config.currency);
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #eee;">
          <strong style="color: #1a1a1a;">${escapeHtml(item.productName)}</strong>
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #eee; text-align: center; color: #4a4a4a;">
          ×${item.quantity}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #eee; text-align: right; color: #c0392b; font-weight: 600;">
          ${money(item.unitPrice * item.quantity)}
        </td>
      </tr>`,
    )
    .join('');
}

function buttonHtml(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display: inline-block; background: linear-gradient(135deg, #c0392b, #e74c3c); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;">${escapeHtml(label)}</a>`;
}

function shellHtml({
  title,
  preheader,
  body,
}: {
  title: string;
  preheader: string;
  body: string;
}): string {
  const marketConfig = getMarketConfig();
  const businessName = marketConfig.name;
  const siteUrl = marketConfig.baseUrl;
  const whatsappDisplay = marketConfig.contact.whatsappDisplay;
  const helpLine = whatsappDisplay
    ? COPY.footerHelpWhatsapp(whatsappDisplay)
    : COPY.footerHelpEmail;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f7f5f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;font-size:0;color:transparent;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f7f5f3;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 36px 36px 0;">
              <h1 style="margin: 0; font-size: 22px; color: #1a1a1a;">${escapeHtml(businessName)}</h1>
            </td>
          </tr>
          ${body}
          <tr>
            <td style="padding: 24px 36px 36px; border-top: 1px solid #eee; color: #888; font-size: 12px; line-height: 1.6;">
              ${escapeHtml(helpLine)}<br/>
              ${escapeHtml(businessName)} · <a href="${escapeHtml(siteUrl)}" style="color: #c0392b; text-decoration: none;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function renderRecoveryH1(params: RecoveryEmailParams): RecoveryEmail {
  const c = COPY;
  const greeting = c.h1Greeting(params.firstName ? escapeHtml(params.firstName) : undefined);
  const body = `
    <tr>
      <td style="padding: 16px 36px 8px;">
        <p style="margin: 0 0 12px; font-size: 16px; color: #1a1a1a;">${greeting}</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.55; color: #4a4a4a;">
          ${c.h1Body}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemRowsHtml(params.items)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 36px 12px; text-align: center;">
        ${buttonHtml(params.recoveryUrl, c.h1Cta)}
      </td>
    </tr>
  `;
  return {
    subject: c.h1Subject,
    html: shellHtml({ title: c.h1Title, preheader: c.h1Preheader, body }),
  };
}

export function renderRecoveryH24(params: RecoveryEmailParams): RecoveryEmail {
  const c = COPY;
  const greeting = c.h24Greeting(params.firstName ? escapeHtml(params.firstName) : undefined);
  const percent = params.couponDiscountPercent ?? 10;
  const couponBlock = params.couponCode
    ? `
    <tr>
      <td style="padding: 8px 36px 0;">
        <div style="background: linear-gradient(135deg, #fff4f7, #fff); border: 2px dashed #c0392b; border-radius: 12px; padding: 18px; text-align: center;">
          <p style="margin: 0 0 6px; font-size: 13px; color: #c0392b; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;">${c.h24CouponEyebrow}</p>
          <p style="margin: 0 0 4px; font-size: 26px; color: #1a1a1a; font-weight: 700; letter-spacing: 0.06em;">${escapeHtml(params.couponCode)}</p>
          <p style="margin: 0; font-size: 13px; color: #4a4a4a;">${c.h24CouponDescription(percent)}</p>
        </div>
      </td>
    </tr>`
    : '';
  const body = `
    <tr>
      <td style="padding: 16px 36px 8px;">
        <p style="margin: 0 0 12px; font-size: 16px; color: #1a1a1a;">${greeting}</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.55; color: #4a4a4a;">
          ${c.h24Body}
        </p>
      </td>
    </tr>
    ${couponBlock}
    <tr>
      <td style="padding: 16px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemRowsHtml(params.items)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 36px 12px; text-align: center;">
        ${buttonHtml(params.recoveryUrl, c.h24Cta)}
      </td>
    </tr>
  `;
  return {
    subject: c.h24Subject(percent),
    html: shellHtml({
      title: c.h24Title,
      preheader: c.h24Preheader(params.couponCode ?? ''),
      body,
    }),
  };
}

export function renderRecoveryH72(params: RecoveryEmailParams): RecoveryEmail {
  const c = COPY;
  const percent = params.couponDiscountPercent ?? 10;
  const couponBlock = params.couponCode
    ? `
    <tr>
      <td style="padding: 8px 36px 0;">
        <div style="background: #1a1a1a; color: #fff; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #ff8a7a; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;">${c.h72CouponEyebrow}</p>
          <p style="margin: 0 0 4px; font-size: 28px; font-weight: 700; letter-spacing: 0.06em;">${escapeHtml(params.couponCode)}</p>
          <p style="margin: 0; font-size: 13px; color: #f0d4dd;">${c.h72CouponDescription(percent)}</p>
        </div>
      </td>
    </tr>`
    : '';
  const body = `
    <tr>
      <td style="padding: 16px 36px 8px;">
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.55; color: #4a4a4a;">
          ${c.h72Body}
        </p>
      </td>
    </tr>
    ${couponBlock}
    <tr>
      <td style="padding: 16px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemRowsHtml(params.items)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 36px 12px; text-align: center;">
        ${buttonHtml(params.recoveryUrl, c.h72Cta)}
      </td>
    </tr>
  `;
  return {
    subject: c.h72Subject,
    html: shellHtml({
      title: c.h72Title,
      preheader: c.h72Preheader,
      body,
    }),
  };
}
