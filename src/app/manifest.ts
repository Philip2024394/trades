import type { MetadataRoute } from "next";
import { XRATED_BRAND } from "@/lib/xratedTrades";

// Web App Manifest — exposes the site as an installable PWA so tradies
// can "Add to Home Screen" from iOS Safari (Share → Add to Home Screen)
// or Chrome on Android (Install app prompt). Once installed, the app
// launches standalone — own icon, splash screen, no browser chrome.
//
// Manifest is Xrated-branded (not Hammerex) because the user's primary
// acquisition push is the Xrated SaaS. Tradies install tools they use
// weekly; shop visitors don't typically install storefronts. Once the
// domains split (xratedtrade.com vs hammerexdirect.com) each gets its
// own manifest.
//
// `start_url` opens to /trade-off so a fresh install lands on the
// Xrated landing. Logged-in tradies who add from their own dashboard
// will still go to /trade-off first — we can't dynamically route a
// static manifest. They can bookmark the dashboard separately.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Xrated Trades — Your shareable trade profile",
    short_name: "Xrated",
    description:
      "The shareable trade profile for tradies anywhere. Reviews, photos, prices, WhatsApp — one link.",
    start_url: "/trade-off",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0A0A0A",
    theme_color: XRATED_BRAND.accent,
    lang: "en-GB",
    dir: "ltr",
    categories: ["business", "productivity", "lifestyle"],
    icons: [
      { src: XRATED_BRAND.logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: XRATED_BRAND.logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: XRATED_BRAND.logoUrl, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: XRATED_BRAND.logoUrl, sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
