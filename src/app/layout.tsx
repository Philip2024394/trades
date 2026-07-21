import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/seo";
import { CookieConsentBanner } from "@/components/xrated/CookieConsentBanner";
import { allFontVariables } from "@/lib/fonts";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Root layout for Thenetworkers. Page chrome (header, footer, dock)
// lives on the route segments themselves; the root only owns html/body,
// brand tokens, the shared metadata defaults, and the site-wide
// Organization + WebSite JSON-LD that every Stripe / search trust
// scraper looks for.
//
// Rebranded 2026-07-10: "Thenetworkers — Of The Construction Trades"
// supersedes "Xrated Trades" as the surface brand. URL host stays
// thenetworkers.app until a new domain is chosen.

const SITE_URL = "https://thenetworkers.app";
const DEFAULT_OG_IMAGE = BRAND.logo;
const DEFAULT_DESCRIPTION =
  "Thenetworkers of the construction trades. Free for life — your business app, canteen, URL, and access to The Yard + Trade Center. Optional Pro £14.99/mo for merchant features. No card. No commission. Ever.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFB300"
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Thenetworkers — Of The Construction Trades",
    template: "%s | Thenetworkers"
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "Thenetworkers",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: BRAND.name,
    title: "Thenetworkers — Of The Construction Trades",
    description: DEFAULT_DESCRIPTION,
    locale: "en_GB",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Thenetworkers — of the construction trades"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Thenetworkers — Of The Construction Trades",
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE]
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  // iOS-specific PWA hints. Without these, an "Add to Home Screen"
  // install launches inside Safari with chrome — defeats the standalone
  // feel.
  appleWebApp: {
    capable: true,
    title: "Thenetworkers",
    statusBarStyle: "black-translucent"
  }
};

// Site-wide structured data. Organization gives Stripe's risk crawler
// (and Google's knowledge panel) the canonical name / logo / contact
// surface. WebSite + SearchAction tells Google our /find endpoint is
// the in-site search box — earns the sitelinks search box treatment.
const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Thenetworkers",
  alternateName: ["Thenetworkers — Of The Construction Trades", "thenetworkers.app"],
  url: SITE_URL,
  logo: BRAND.logo,
  description:
    "Thenetworkers of the construction trades. Studio, App Warehouse, The Yard, and a public profile — one platform for UK construction trades.",
  sameAs: [] as string[],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@thenetworkers.app",
      areaServed: "GB",
      availableLanguage: ["en-GB", "en"]
    }
  ]
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND.name,
  url: SITE_URL,
  inLanguage: "en-GB",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/find?q={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={allFontVariables}>
      <head>
        {/* App Studio fonts — preloaded once at the root so every
            tradesperson's font_family pick (Inter / Roboto / Lora /
            Playfair / Montserrat) renders without a flash of fallback.
            See src/lib/tradeBrandTheme.ts for the picker list. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Lora:wght@400;600;700&family=Montserrat:wght@400;600;800&family=Playfair+Display:wght@400;600;800&family=Roboto:wght@400;500;700&display=swap"
        />
        {/* Site-wide JSON-LD. Inlined in <head> via Next's standard
            <script> insertion so every page (marketing, listing,
            templated trade landing) carries the Organization +
            WebSite schemas without per-route duplication. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
        />
        {/* Newsroom RSS auto-discovery — feed readers + editorial
            bots pick this up on any page load. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="The Networkers — Newsroom"
          href="/news/feed.xml"
        />
      </head>
      <body className="bg-brand-bg text-brand-text antialiased">
        {/* Skip-to-content — invisible until focused, keyboard users
            can jump straight past chrome to the page's <main>. WCAG
            2.1 SC 2.4.1. Every route shell should mark its <main>
            with id="main". */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1000] focus:rounded-md focus:bg-brand-yellow focus:px-3 focus:py-2 focus:text-sm focus:font-black focus:text-brand-black focus:shadow-lg"
        >
          Skip to content
        </a>
        {children}
        {/* GDPR / UK PECR consent banner — first-party cookie, no SDK.
            Renders nothing on the server and self-hides once the visitor
            has chosen, so it never blocks page chrome on repeat visits. */}
        <CookieConsentBanner />
        {/* Vercel Analytics + Speed Insights — Web Vitals + pageview
            telemetry. No config required on Vercel deployments;
            no-ops in dev + on other hosts. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
