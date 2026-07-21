import type { MetadataRoute } from "next";
import { DEMO_TRADE_SEEDS } from "@/lib/demoTradeSeeds";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { isLeadCaseStudy } from "@/lib/leadCaseStudies";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UK_CITIES, allCitySlugs } from "@/lib/uk-cities";

// Full sitemap for thenetworkers.app — surfaces the marketing pages, the
// templated trade landings (108 entries), every demo profile (106
// entries), legal pages, and core utility routes. Stripe risk reviews
// (and trust-signal scrapers in general) read a well-organised sitemap
// as evidence of an established business; thin or missing sitemaps get
// flagged on brand-name pattern alone.

// Canonical origin — env-driven so a future rebrand can flip without a
// code change. Default is thenetworkers.app (single-domain model).
const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://thenetworkers.app";

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
    // Comparative-advertising landings (per-jurisdiction, legal
    // framework in docs/LEGAL_UK/US/AU_COMPARATIVE_ADVERTISING.md)
    "/trade-off/compare-platforms",
    "/trade-off/uk/compare-platforms",
    "/trade-off/us/compare-platforms",
    "/trade-off/au/compare-platforms",
    "/trade-off/every-channel",
    // Homeowner surfaces — SiteBook front door + auth
    "/homeowners",
    "/homeowners/login",
    "/homeowners/signup",
    // SiteBook showcase (mock demo for prospects — safe to index)
    "/sitebook-showcase/the-old-rectory",
    "/news",
    "/find",
    "/showcase",
    "/site-office",
    // Platform-level pages — required by Stripe's trust + compliance
    // checklist and used by the global footer's Company column.
    "/about",
    "/contact",
    "/status",
    "/legal/image-licence"
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

  // Local UK city landing pages — /find/{city}. Reads from the shared
  // UK_CITIES catalog (src/lib/uk-cities.ts). Adding a city there
  // immediately ships /find/{city} + every /trade-off/{trade}/{city}
  // permutation below.
  const cityLandings: Entry[] = allCitySlugs().map((slug) => ({
    url: url(`/find/${slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.75
  }));

  // Trade × city cross-product — this is the big SEO surface unlock.
  // Every /trade-off/{trade}/{city} URL emitted so Google can index the
  // full grid: "electrician manchester", "plumber leeds", etc.
  // 108 trades × ~100 cities = ~10,800 pages. Priority is weighted:
  //   top 20 cities × any trade → 0.7 (bigger cities = bigger search vol)
  //   remaining              → 0.5
  // Google's sitemap limit is 50k per file so we're comfortably within.
  const topCitySlugs = new Set(
    [...UK_CITIES].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, 20).map((c) => c.slug)
  );
  const tradeCityCross: Entry[] = [];
  for (const trade of TRADE_OFF_TRADES) {
    for (const city of UK_CITIES) {
      tradeCityCross.push({
        url: url(`/trade-off/${trade.slug}/${city.slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: topCitySlugs.has(city.slug) ? 0.7 : 0.5
      });
    }
  }

  // Programmatic /trades/[trade]/[city] pages — Phase 1 SEO seed.
  // 5 trades × 10 UK cities = 50 URLs. Priority 0.85 (higher than
  // trade-off variant) because these are the SEO-optimised versions
  // with rich schema + trade-authored content + real listings + FAQs.
  // (Moved from /find/ to /trades/ 2026-07-20 — the existing
  // /find/[city] homeowner surface conflicted with sibling dynamic
  // segments in Next.js.)
  const { TRADES: FIND_TRADES, CITIES: FIND_CITIES } = await import("./trades/[trade]/[city]/config");
  const findPages: Entry[] = [
    // /trades hub — top of the funnel
    { url: url("/trades"), lastModified: now, changeFrequency: "weekly" as const, priority: 0.95 }
  ];
  for (const trade of FIND_TRADES) {
    // /trades/[trade] national landing
    findPages.push({
      url: url(`/trades/${trade}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9
    });
    // /trades/[trade]/[city] city variants
    for (const city of FIND_CITIES) {
      findPages.push({
        url: url(`/trades/${trade}/${city}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.85
      });
    }
  }

  // /price-index — UK Trade Price Index (Phase 2 SEO — data authority).
  // /grants — UK Home Improvement Grants Tracker (Phase 2 SEO —
  // data authority + high-intent evergreen).
  // /answers + /answers/[slug] — UK Trade Q&A hub (Phase 2 SEO
  // third pillar; QAPage schema so Google surfaces answers
  // directly in the SERP).
  const dataAuthority: Entry[] = [
    { url: url("/price-index"), lastModified: now, changeFrequency: "monthly" as const, priority: 0.95 },
    { url: url("/grants"),      lastModified: now, changeFrequency: "monthly" as const, priority: 0.95 },
    { url: url("/answers"),     lastModified: now, changeFrequency: "weekly"  as const, priority: 0.9  },
    { url: url("/check-quote"), lastModified: now, changeFrequency: "monthly" as const, priority: 0.9  },
    { url: url("/careers"),     lastModified: now, changeFrequency: "monthly" as const, priority: 0.9  },
    // Apprenticeship request hub — 16+ young-person applications
    // routed to verified local trades. Individual /apprenticeships/[id]
    // pages are noindex (private profile detail); hub + apply page are
    // both index=true for SEO.
    { url: url("/apprenticeships"),       lastModified: now, changeFrequency: "hourly"  as const, priority: 0.85 },
    { url: url("/apprenticeships/apply"), lastModified: now, changeFrequency: "monthly" as const, priority: 0.85 },
    // The Vault — long-form editorial. Hub + leaf articles.
    { url: url("/vault"),                 lastModified: now, changeFrequency: "weekly"  as const, priority: 0.9  },
    // Trade Encyclopaedia — third intent per trade slug (understand
    // what they do). Hub + leaf pages.
    { url: url("/what-is"),               lastModified: now, changeFrequency: "monthly" as const, priority: 0.9  },
    // UK Regions — bridges national + city SEO layers. 7 regions,
    // each cross-referencing member cities + trades + grants.
    { url: url("/regions"),               lastModified: now, changeFrequency: "monthly" as const, priority: 0.9  },
    // The Toolbox — unified discovery landing (renamed from /explore
    // on 2026-07-20). "Everything at hand's reach."
    { url: url("/toolbox"),               lastModified: now, changeFrequency: "monthly" as const, priority: 0.95 },
    // /vs — Phase 3 UK trade platform comparison hub + per-competitor leaves.
    { url: url("/vs"),                    lastModified: now, changeFrequency: "monthly" as const, priority: 0.9  },
    // /case-studies — Phase 3 real project write-ups. Hub + submit
    // page ship indexed; leaves auto-emit from generateStaticParams.
    { url: url("/case-studies"),          lastModified: now, changeFrequency: "weekly"  as const, priority: 0.9  },
    { url: url("/case-studies/submit"),   lastModified: now, changeFrequency: "monthly" as const, priority: 0.85 },
    // /emergency — Phase 3 UK trade emergency guide. Hub + per-emergency leaves.
    { url: url("/emergency"),             lastModified: now, changeFrequency: "monthly" as const, priority: 0.95 },
    // /videos — Networkers TV hub. Leaf pages (/videos/[id]) are
    // auto-indexed when Google follows on-page links from the hub +
    // category browse pages.
    { url: url("/videos"),                lastModified: now, changeFrequency: "daily" as const, priority: 0.95 }
  ];
  // Category browse pages /videos/c/[slug] — one per top-level
  // category. Query the live DB so new categories auto-index.
  try {
    const { data: cats } = await supabaseAdmin
      .from("hammerex_video_categories")
      .select("slug")
      .is("parent_slug", null);
    (cats ?? []).forEach((c) => {
      dataAuthority.push({
        url:             url(`/videos/c/${c.slug}`),
        lastModified:    now,
        changeFrequency: "weekly" as const,
        priority:        0.9
      });
    });
  } catch { /* silent — sitemap should never fail on optional data */ }
  const { EMERGENCIES } = await import("./emergency/config");
  for (const e of EMERGENCIES) {
    dataAuthority.push({
      url:             url(`/emergency/${e.slug}`),
      lastModified:    new Date(e.lastReviewed),
      changeFrequency: "monthly" as const,
      priority:        0.9
    });
  }
  const { CASE_STUDIES } = await import("./case-studies/config");
  for (const cs of CASE_STUDIES) {
    if (cs.status === "published") {
      dataAuthority.push({
        url:             url(`/case-studies/${cs.slug}`),
        lastModified:    new Date(cs.lastReviewedAt),
        changeFrequency: "monthly" as const,
        priority:        0.85
      });
    }
  }
  const { COMPETITORS } = await import("./vs/config");
  for (const c of COMPETITORS) {
    dataAuthority.push({
      url:             url(`/vs/${c.slug}`),
      lastModified:    new Date(c.lastVerified),
      changeFrequency: "monthly" as const,
      priority:        0.85
    });
  }
  const { REGIONS } = await import("./regions/config");
  for (const r of REGIONS) {
    dataAuthority.push({
      url:             url(`/regions/${r.slug}`),
      lastModified:    now,
      changeFrequency: "monthly" as const,
      priority:        0.85
    });
  }
  const { ARTICLES: VAULT_ARTICLES } = await import("./vault/config");
  for (const a of VAULT_ARTICLES) {
    dataAuthority.push({
      url:             url(`/vault/${a.slug}`),
      lastModified:    new Date(a.lastReviewedAt),
      changeFrequency: "monthly" as const,
      priority:        0.85
    });
  }
  const { WHAT_IS: WHAT_IS_ENTRIES } = await import("./what-is/config");
  for (const w of WHAT_IS_ENTRIES) {
    dataAuthority.push({
      url:             url(`/what-is/${w.slug}`),
      lastModified:    new Date(w.lastReviewed),
      changeFrequency: "monthly" as const,
      priority:        0.85
    });
  }
  const { CAREER_GUIDES } = await import("./careers/config");
  for (const g of CAREER_GUIDES) {
    dataAuthority.push({
      url:             url(`/careers/${g.slug}`),
      lastModified:    new Date(g.lastReviewed),
      changeFrequency: "monthly" as const,
      priority:        0.85
    });
  }
  const { ANSWERS: QA_ANSWERS } = await import("./answers/config");
  for (const a of QA_ANSWERS) {
    dataAuthority.push({
      url:             url(`/answers/${a.slug}`),
      lastModified:    new Date(a.lastReviewed),
      changeFrequency: "monthly" as const,
      priority:        0.85
    });
  }

  // Programmatic /planning/[project] pages — Phase 1 SEO seed.
  // 10 planning permission checkers. Priority 0.9 — "do I need
  // planning permission for X" is one of the highest-intent construction
  // queries on Google (30k+ combined searches/mo in the UK).
  const { PLANNING_PROJECTS } = await import("./planning/[project]/config");
  const planningPages: Entry[] = PLANNING_PROJECTS.map((project) => ({
    url: url(`/planning/${project}`),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.9
  }));

  // Programmatic /cost/[project] and /cost/[project]/[city] pages —
  // Phase 1 SEO seed (calculators). 5 projects × 11 (national + 10
  // cities) = 55 URLs. Priority 0.9 — cost calculators are the
  // highest-search-volume tools in construction SEO.
  const { PROJECTS: COST_PROJECTS } = await import("./cost/[project]/config");
  const costPages: Entry[] = [];
  for (const project of COST_PROJECTS) {
    costPages.push({
      url: url(`/cost/${project}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9
    });
    for (const city of FIND_CITIES) {
      costPages.push({
        url: url(`/cost/${project}/${city}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.85
      });
    }
  }

  return [
    root,
    ...main,
    ...tradeLandings,
    ...cityLandings,
    ...tradeCityCross,
    ...findPages,
    ...dataAuthority,
    ...planningPages,
    ...costPages,
    ...demoProfiles,
    ...liveListings,
    ...yardPosts,
    ...legal,
    ...news
  ];
}
