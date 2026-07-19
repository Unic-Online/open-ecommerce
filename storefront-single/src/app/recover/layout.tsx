// Recovery URL root layout. /recover/[token] is not localized (cart
// recovery links are server-rendered with a market stored on the cart
// doc), so it needs its own <html>/<body> now that the project no longer
// has a global app/layout.tsx.
//
// `lang` stays static — the page is a transient redirect (robots: noindex
// below) so the brief mismatch on FR isn't worth making the layout dynamic.
// A previous attempt resolved lang from the request host but caused
// server-side errors on some preview hosts; reverted for stability.
import "../globals.css";

export const metadata = {
  title: 'Recovery',
  robots: { index: false, follow: false },
};

export default function RecoverRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
