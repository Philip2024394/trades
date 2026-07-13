import type { MetadataRoute } from "next";

// robots.txt — open for indexing of the marketing + listing surface,
// blocked for the dashboards (/trade-off/edit/*, /studio/*, /home/*)
// and the JSON API (/api/*). Stripe risk + trust scrapers fetch this
// first to confirm the site is intentionally indexable.

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://xratedtrade.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/trade-off/edit/",
          "/studio/",
          "/home/",
          "/inbox/"
        ]
      }
    ],
    host: SITE,
    sitemap: `${SITE}/sitemap.xml`
  };
}
