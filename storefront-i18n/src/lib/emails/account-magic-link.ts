/**
 * Magic-link login email — pure HTML renderer.
 *
 * Caller contract: `linkUrl` MUST be the fully-qualified verify URL
 * (host + /api/account/verify?token=...). The email body intentionally
 * states the 15-minute TTL so the recipient knows late clicks will bounce.
 */

interface MagicLinkEmailArgs {
  linkUrl: string;
  locale: 'ro' | 'en';
}

interface Copy {
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  cta: string;
  ttl: string;
  ignore: string;
  footer: string;
}

const COPY: Record<'ro' | 'en', Copy> = {
  ro: {
    subject: 'Conectează-te la contul tău Acme Store',
    preheader: 'Apasă pe link ca să intri în cont. Linkul este valabil 15 minute.',
    heading: 'Conectare la contul tău',
    body:
      'Apasă pe butonul de mai jos ca să intri în contul tău Acme Store și să vezi comenzile.',
    cta: 'Intră în cont',
    ttl: 'Linkul este valabil 15 minute și poate fi folosit o singură dată.',
    ignore:
      'Dacă nu ai cerut tu acest link, ignoră emailul — nu se va întâmpla nimic.',
    footer: 'Acme Store — ro.shop.example.com',
  },
  en: {
    subject: 'Sign in to your Acme Store account',
    preheader: 'Tap the link to access your account. The link is valid for 15 minutes.',
    heading: 'Access your account',
    body:
      'Tap the button below to sign in to your Acme Store account and view your orders.',
    cta: 'Open my account',
    ttl: 'This link is valid for 15 minutes and can only be used once.',
    ignore:
      "If you didn't request this link, please ignore this email — no action will be taken.",
    footer: 'Acme Store — shop.example.com',
  },
};

export function renderAccountMagicLinkEmail({
  linkUrl,
  locale,
}: MagicLinkEmailArgs): { subject: string; html: string; text: string } {
  const c = COPY[locale];
  const html = `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${c.subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Jost,system-ui,sans-serif;color:#1a1d24;">
    <span style="display:none;font-size:0;line-height:0;color:#f5f5f5;">${c.preheader}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.04);">
            <tr><td>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1d24;">${c.heading}</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#3a3d44;">${c.body}</p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr><td>
                  <a href="${linkUrl}" style="display:inline-block;background:#e74c3c;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;">${c.cta}</a>
                </td></tr>
              </table>
              <p style="margin:24px 0 8px;font-size:13px;color:#6b6f78;">${c.ttl}</p>
              <p style="margin:0 0 24px;font-size:13px;color:#6b6f78;">${c.ignore}</p>
              <p style="margin:0;padding-top:24px;border-top:1px solid #eee;font-size:12px;color:#9ca0aa;">${c.footer}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${c.heading}\n\n${c.body}\n\n${c.cta}: ${linkUrl}\n\n${c.ttl}\n${c.ignore}\n\n${c.footer}`;

  return { subject: c.subject, html, text };
}
