import type { MetadataRoute } from "next";
import { DEMO_TRADE_SEEDS } from "@/lib/demoTradeSeeds";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { isLeadCaseStudy } from "@/lib/leadCaseStudies";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Full sitemap for xratedtrade.com — surfaces the marketing pages, the
// templated trade landings (108 entries), every demo profile (106
// entries), legal pages, and core utility routes. Stripe risk reviews
// (and trust-signal scrapers in general) read a well-organised sitemap
// as evidence of an established business; thin or missing sitemaps get
// flagged on brand-name pattern alone.

// Canonical origin — env-driven so the rebrand to
// theconstructionnotebook.com can flip without a code change. Default
// preserves current xratedtrade.com behaviour.
const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://xratedtrade.com";

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    "/news",
    "/find",
    "/showcase",
    "/site-office",
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
  //
  // The 6 lead case studies (Marcus, Emma, Jamie, Stuart, Rebecca,
  // Charlotte) are bumped to priority 0.85 — they're the showcase
  // surfaces that earn extra reviews, diary entries and richer JSON-LD
  // each week, so the "weekly" cadence is genuinely true for them.
  const demoProfiles: Entry[] = DEMO_TRADE_SEEDS.map((seed) => ({
    url: url(`/trade/${seed.profile_slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: isLeadCaseStudy(seed.profile_slug) ? 0.85 : 0.7
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

  // Newsroom posts — one URL per live row in
  // hammerex_xrated_news_posts. Drafts + archived rows are intentionally
  // omitted so Google never sees them.
  let news: Entry[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("hammerex_xrated_news_posts")
      .select("slug, published_at")
      .eq("status", "live")
      .order("published_at", { ascending: false })
      .limit(500);
    news = (data ?? []).map((row) => ({
      url: url(`/news/${row.slug}`),
      lastModified: row.published_at ? new Date(row.published_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7
    }));
  } catch (err) {
    console.error("[sitemap] news posts load failed:", err);
  }

  // Live merchant listings — real trades who joined. Dedup against the
  // demo profile slugs since those are already emitted above.
  let liveListings: Entry[] = [];
  try {
    const demoSlugs = new Set(DEMO_TRADE_SEEDS.map((s) => s.profile_slug));
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, updated_at")
      .eq("status", "live")
      .order("updated_at", { ascending: false })
      .limit(1000);
    liveListings = (data ?? [])
      .filter((row) => row.slug && !demoSlugs.has(row.slug))
      .map((row) => ({
        url: url(`/trade/${row.slug}`),
        lastModified: row.updated_at ? new Date(row.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.75
      }));
  } catch (err) {
    console.error("[sitemap] live listings load failed:", err);
  }

  // Live public Yard posts — surface every listing so buyers land
  // straight on the item page from search. Auto-expiring posts drop
  // out on the next sitemap refresh.
  let yardPosts: Entry[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("id, created_at, expires_at")
      .eq("status", "live")
      .is("parent_id", null)
      .not("moderation_status", "in", '("hidden","spam")')
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);
    yardPosts = (data ?? []).map((row) => ({
      url: url(`/trade-off/yard/${row.id}`),
      lastModified: row.created_at ? new Date(row.created_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.55
    }));
  } catch (err) {
    console.error("[sitemap] yard posts load failed:", err);
  }

  return [
    root,
    ...main,
    ...tradeLandings,
    ...demoProfiles,
    ...liveListings,
    ...yardPosts,
    ...legal,
    ...news
  ];
}
