/**
 * Post-delivery review-request email — sent once per order a few days after
 * `fulfillment.status` reaches `delivered`. Idempotency (the once-only send)
 * is enforced upstream by the eligibility query + `markReviewEmailSent` in
 * `@/lib/orders/mutations`; this module is pure rendering.
 *
 * Invariants:
 *   - Locale + market come from the ORDER, not the request — same rule as
 *     shipment-email.ts.
 *   - This is a service email, not marketing: no discount code, no upsell.
 *     One CTA per distinct purchased product, linking to that product's page
 *     with the `#recenzii` anchor (the id `ProductPage.tsx` already renders
 *     on the reviews `<section>` — do not invent a different anchor).
 *   - Each CTA carries a `?rt=` token (`signReviewToken(orderId, slug)`) so a
 *     review submitted from this link is honestly labelled as a verified
 *     purchase — see `verifyReviewToken` in `/api/reviews`. A signing
 *     failure here is caught by the cron's per-order try/catch (counts as a
 *     failed send, retried next run) rather than silently omitting the token.
 *   - Sender is `marketConfig.contact.fromEmail`; the reply-to contact line
 *     in the body reads `marketConfig.contact.businessEmail`. The sign-off
 *     uses `marketConfig.name` — never a hardcoded brand string, so a
 *     rebrand via `site.config.ts` propagates automatically.
 */
import type { OrderDoc } from '@/lib/orders/types';
import type { ResolvedCartLine } from '@/lib/cart-resolver';
import { getMarketConfig } from '@/i18n/market-config';
import type { LocaleKey } from '@/i18n/locales';
import { categories } from '@/site.config';
import { signReviewToken } from '@/lib/orders/review-token';

interface Copy {
  subjectOne: (name: string) => string;
  subjectMany: string;
  greeting: (firstName: string) => string;
  intro: string;
  productsTitle: string;
  ctaButton: string;
  closing: string;
  signOff: (brand: string) => string;
  contactLine: (email: string) => string;
}

const COPY: Record<LocaleKey, Copy> = {
  ro: {
    subjectOne: (name) => `Cum ți se pare ${name}? Lasă o recenzie`,
    subjectMany: 'Cum ți se par produsele tale? Lasă o recenzie',
    greeting: (n) => `Bună, ${n}!`,
    intro:
      'Sperăm că ești mulțumit(ă) de comanda ta. Părerea ta contează pentru noi și pentru ceilalți clienți — durează doar un minut să lași o recenzie:',
    productsTitle: 'Produsele tale',
    ctaButton: 'Lasă o recenzie',
    closing:
      'Îți mulțumim că ne-ai ales. Dacă ai nelămuriri legate de comandă, răspunde direct la acest email.',
    signOff: (brand) => `Echipa ${brand}`,
    contactLine: (email) => `Ai o întrebare? Scrie-ne la ${email}.`,
  },
  en: {
    subjectOne: (name) => `How do you like ${name}? Leave a review`,
    subjectMany: 'How do you like your products? Leave a review',
    greeting: (n) => `Hello ${n},`,
    intro:
      'We hope you are enjoying your order. Your opinion matters to us and to future customers — it only takes a minute to leave a review:',
    productsTitle: 'Your products',
    ctaButton: 'Leave a review',
    closing:
      'Thank you for choosing us. For any question about your order, just reply to this email.',
    signOff: (brand) => `The ${brand} team`,
    contactLine: (email) => `Questions? Write to us at ${email}.`,
  },
};

export function reviewRequestEmailSubject(order: OrderDoc): string {
  const c = COPY[order.locale];
  const distinctNames = Array.from(new Set(order.items.map((item) => item.productName)));
  if (distinctNames.length === 1) return c.subjectOne(distinctNames[0]);
  return c.subjectMany;
}

/** Product page URL anchored to its reviews section. Falls back to the raw
 *  category-key segment if a category lookup ever misses (defensive only —
 *  every persisted `productType` maps to a registered category today). */
function productReviewUrl(item: ResolvedCartLine, order: OrderDoc): string {
  const marketConfig = getMarketConfig(order.market);
  const category = categories.find((cat) => cat.key === item.productType);
  const pathname = category ? category.pathnames[order.locale] : `/${item.productType}`;
  const token = signReviewToken(order.orderId, item.slug);
  return `${marketConfig.baseUrl}${pathname}/${item.slug}?rt=${encodeURIComponent(token)}#recenzii`;
}

export function renderReviewRequestEmail({ order }: { order: OrderDoc }): string {
  const marketConfig = getMarketConfig(order.market);
  const c = COPY[order.locale];

  // One CTA per distinct product — qty>1 of the same item must not repeat the card.
  const seenSlugs = new Set<string>();
  const products = order.items.filter((item) => {
    if (seenSlugs.has(item.slug)) return false;
    seenSlugs.add(item.slug);
    return true;
  });

  const productRows = products
    .map(
      (item) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #eee;">
          <p style="margin:0 0 12px;color:#1a1d24;font-size:15px;font-weight:600;">${escapeHtml(item.productName)}</p>
          <a href="${productReviewUrl(item, order)}" style="display:inline-block;background:#e74c3c;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:14px;">${c.ctaButton}</a>
        </td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${order.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(reviewRequestEmailSubject(order))}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;color:#1a1d24;font-family:Jost,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;padding:0 20px;">
        <tr><td>

          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#1a1d24;font-size:24px;font-weight:600;margin:0;">${escapeHtml(marketConfig.name)}</h1>
            <p style="color:#6b6f78;font-size:15px;margin:12px 0 0;">${c.greeting(escapeHtml(order.shipping.firstName))}</p>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #e8e8e8;border-radius:14px;padding:24px;margin-bottom:20px;">
            <tr><td>
              <p style="margin:0 0 16px;color:#1a1d24;font-size:14px;line-height:1.55;">${c.intro}</p>
              <h2 style="font-size:12px;margin:0 0 4px;color:#6b6f78;text-transform:uppercase;letter-spacing:0.05em;">${c.productsTitle}</h2>
              <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
                <tbody>${productRows}</tbody>
              </table>
            </td></tr>
          </table>

          <div style="text-align:center;color:#6b6f78;font-size:13px;padding-top:12px;border-top:1px solid #e8e8e8;">
            <p style="margin:0 0 8px;">${c.closing}</p>
            <p style="margin:0 0 8px;">${c.signOff(escapeHtml(marketConfig.name))}</p>
            <p style="margin:0;">${c.contactLine(escapeHtml(marketConfig.contact.businessEmail))}</p>
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
