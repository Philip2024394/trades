import type { MetadataRoute } from "next";

// Phase 1 — static marketing sitemap. Listings will be added in a
// future polish round (requires a Supabase fetch).
const SITE = "https://xratedtrade.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    "/",
    "/trade-off",
    "/trade-off/pricing",
    "/trade-off/add-ons",
    "/trade-off/why",
    "/trade-off/how",
    "/trade-off/what",
    "/trade-off/verified"
  ];
  return paths.map((p) => ({
    url: `${SITE}${p === "/" ? "" : p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "/" ? 1 : 0.7
  }));
}
