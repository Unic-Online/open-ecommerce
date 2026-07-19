// Admin root layout. Admin lives outside [locale] (it is not localized)
// and therefore needs its own <html>/<body> shell now that the global
// app/layout.tsx has been removed in favor of segment-owned root layouts.
// The auth gate lives in app/admin/(authed)/layout.tsx; /admin/login is a
// sibling that bypasses the gate.
//
// The whole /admin tree is also gated by the `admin` feature flag in
// `proxy.ts` (404s before any route runs); the `notFoundUnless` here is a
// defense-in-depth gate at the layout level so the section is inert even if
// the proxy matcher is ever bypassed.
import { Jost } from "next/font/google";
import "../globals.css";
import { notFoundUnless } from "@/lib/feature-flags";
import { features } from "@/site.config";

// Why: globals.css resolves --font-display/--font-body via var(--font-jost).
// This shell renders its own <html>, so the variable must be loaded here or
// the admin falls back to the browser default (serif).
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: 'Acme Store — admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  notFoundUnless(features.admin);
  return (
    <html lang="ro" className={jost.variable}>
      <body>{children}</body>
    </html>
  );
}
