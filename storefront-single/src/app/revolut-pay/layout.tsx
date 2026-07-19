// Revolut Pay return root layout. /revolut-pay/return/[result] is a
// mobile-wallet return endpoint that resolves the order and redirects;
// it is not localized. Owns its own <html>/<body> because the project has
// removed the global app/layout.tsx in favor of segment-owned root layouts.
import "../globals.css";

export const metadata = {
  title: 'Acme Store — confirmare plată',
  robots: { index: false, follow: false },
};

export default function RevolutPayRootLayout({
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
