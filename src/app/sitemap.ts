import type { MetadataRoute } from "next";
import { DEMO_TRADE_SEEDS } from "@/lib/demoTradeSeeds";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";

// Full sitemap for xratedtrade.com — surfaces the marketing pages, the
// templated trade landings (108 entries), every demo profile (106
// entries), legal pages, and core utility routes. Stripe risk reviews
// (and trust-signal scrapers in general) read a well-organised sitemap
// as evidence of an established business; thin or missing sitemaps get
// flagged on brand-name pattern alone.

const SITE = "https://xratedtrade.com";

type Entry = MetadataRoute.Sitemap[number];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const url = (path: string) => `${SITE}${path === "/" ? "" : path}`;

  const root: Entry = {
    url: url("/"),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 1.0
  };

  // Primary marketing + product pages — high priority, weekly cadence.
  const mainPaths = [
    "/trade-off",
    "/trade-off/trades",
    "/trade-off/pricing",
    "/trade-off/add-ons",
    "/trade-off/faq",
    "/trade-off/why",
    "/trade-off/how",
    "/trade-off/what",
    "/trade-off/verified",
    "/trade-off/verified-waitlist",
    "/trade-off/compare",
    "/trade-off/reviews",
    "/trade-off/services",
    "/trade-off/share",
    "/trade-off/tips",
    "/trade-off/trust",
    "/trade-off/help",
    "/trade-off/jobs",
    "/trade-off/yard",
    "/find",
    // Platform-level pages — required by Stripe's trust + compliance
    // checklist and used by the global footer's Company column.
    "/about",
    "/contact",
    "/status"
  ];
  const main: Entry[] = mainPaths.map((p) => ({
    url: url(p),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9
  }));

  // Templated trade landings — one per slug in TRADE_OFF_TRADES (108).
  const tradeLandings: Entry[] = TRADE_OFF_TRADES.map((t) => ({
    url: url(`/trade-off/${t.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8
  }));

  // Demo tradesperson profiles — `/trade/<profile_slug>` is the real
  // listing route in this codebase (the task spec said `/<profile_slug>`
  // but no top-level [slug] page exists). 106 seeds via DEMO_TRADE_SEEDS.
  const demoProfiles: Entry[] = DEMO_TRADE_SEEDS.map((seed) => ({
    url: url(`/trade/${seed.profile_slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7
  }));

  // Legal pages — created by sibling agent; included so search crawl
  // arrives the moment the routes land.
  const legalPaths = [
    "/legal/terms",
    "/legal/privacy",
    "/legal/refunds",
    "/legal/aup"
  ];
  const legal: Entry[] = legalPaths.map((p) => ({
    url: url(p),
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.5
  }));

  return [root, ...main, ...tradeLandings, ...demoProfiles, ...legal];
}
