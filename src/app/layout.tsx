import type { Metadata, Viewport } from "next";
import "./globals.css";

// Minimal root layout for Xrated Trades — Phase 1 of the split from
// the Hammerex monorepo. Page chrome (header, footer, dock) lives on
// the Xrated route segments themselves (`/trade-off/*` and
// `/trade/<slug>/*`); the root layout only owns html/body, brand
// tokens, and the shared metadata defaults.

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFB300"
};

export const metadata: Metadata = {
  metadataBase: new URL("https://xratedtrade.com"),
  title: {
    default: "Xrated Trades — Your shareable trade profile",
    template: "%s | Xrated Trades"
  },
  description:
    "The shareable trade profile for tradies anywhere. Reviews, photos, prices, WhatsApp — one link.",
  applicationName: "Xrated",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  // iOS-specific PWA hints. Without these, an "Add to Home Screen"
  // install on iPhone launches inside Safari with chrome — defeats the
  // standalone feel.
  appleWebApp: {
    capable: true,
    title: "Xrated",
    statusBarStyle: "black-translucent"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-brand-bg text-brand-text antialiased">{children}</body>
    </html>
  );
}
