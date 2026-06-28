import type { MetadataRoute } from "next";

// robots.txt — open for indexing of the marketing + listing surface,
// blocked for the dashboard (/trade-off/edit/*) and the JSON API
// (/api/*). Stripe risk + trust scrapers fetch this first to confirm
// the site is intentionally indexable.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/trade-off/edit/"]
      }
    ],
    host: "https://xratedtrade.com",
    sitemap: "https://xratedtrade.com/sitemap.xml"
  };
}
