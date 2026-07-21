// scripts/backfill-canteen-examples.mjs
//
// Backfill hero banner + 5 example posts on every existing canteen
// that hasn't been seeded yet (Philip 2026-07-20). Never overwrites a
// canteen that already has a hero, and never re-inserts example posts
// if any is_sample=true row already exists for the listing.
//
// Self-contained — mirrors the logic in src/lib/canteens/seed.ts but
// with a plain Node-friendly import chain so it can run as an mjs
// script without the Next.js "server-only" gate.
//
// Run: node scripts/backfill-canteen-examples.mjs

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supa = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Hero library — read once and pick trade-appropriate images by keyword.
const heroLib = JSON.parse(readFileSync("scripts/hero-library.json", "utf8"));
function normalise(s) { return s.toLowerCase().replace(/-/g, " ").trim(); }
function pickHeroForTrade(tradeSlug) {
  const needle = normalise(tradeSlug);
  const synonyms = new Set([needle]);
  // Map common category slugs to hero library keywords
  const map = {
    carpentry: ["carpenter", "joiner", "wood workshop"],
    joinery:   ["joiner", "carpenter", "bespoke joinery"],
    plastering:["plasterer", "plastering", "skimming"],
    plumbing:  ["plumber", "plumbing"],
    electrical:["electrician", "electrical"],
    roofing:   ["roofer", "roofing"],
    bricklaying: ["bricklayer", "brickwork"],
    landscaping: ["landscaper", "landscape design"],
    tiling:    ["tiler", "tiling"],
    demolition:["demolition", "demolition contractor"],
    "steel-fixing": ["steel fixer", "rebar", "reinforcement"]
  };
  for (const s of (map[tradeSlug] ?? [])) synonyms.add(s);
  for (const e of heroLib.entries) {
    if (e.recommended_use !== "hero") continue;
    if (e.is_banner) continue;
    for (const k of (e.keywords_strict ?? [])) {
      if (synonyms.has(normalise(k))) return e.image_url;
    }
  }
  return null;
}

// `kind` valid values (from CHECK constraint):
//   available | needed | chat | product | job-seek | job-offer
//   collab-help | tools-sell | tools-buy | tools-rent
//   materials-surplus | abroad-job | promo | beacon
const TRADE_EXAMPLE_POSTS = {
  carpentry: [
    { kind: "available", title: "Bespoke oak staircase finished this week", body: "Hand-cut treads, dovetailed newel posts, hand-rubbed oil finish. Full photo set on request." },
    { kind: "materials-surplus", title: "Reclaimed pitch pine flooring available", body: "12m² of 150mm-wide reclaimed pitch pine, 22mm thick. Great for period property renovation." },
    { kind: "available", title: "Kitchen cabinet doors made to spec", body: "Solid oak or painted MDF. Any profile — shaker, slab, beaded. Sample on request before order." },
    { kind: "chat", title: "On-site fitting week starts Monday", body: "Two full days available for wardrobe or built-in fitting jobs. Message for quote." },
    { kind: "job-offer", title: "Looking for a second joiner on a large kitchen fit", body: "3-day job starting next Tuesday, day rate agreed. Own tools + van essential." }
  ],
  plastering: [
    { kind: "available", title: "Full house re-skim finished this week", body: "3-bed semi, ceilings and walls throughout. Clean site, dust extraction used, ready for decoration Friday." },
    { kind: "available", title: "External render available for summer", body: "Silicone-modified render, K-rend and Weber approved installer. Colour matched to sample." },
    { kind: "available", title: "Small repair jobs welcome", body: "Cracks, holes, water damage, ceiling patches. No job too small — quoted honestly, next-week turnaround." },
    { kind: "chat", title: "Feature wall Venetian plaster demo", body: "Polished Venetian in feature colours. Sample panel on request before booking." },
    { kind: "job-offer", title: "Labourer wanted — mixing + hawk carrying", body: "Two days a week, cash paid daily. Learn on the job if keen." }
  ],
  plumbing: [
    { kind: "available", title: "Full bathroom refit starting Monday", body: "Copper pipework throughout, wall-hung units, thermostatic shower. Full photo set on completion." },
    { kind: "available", title: "Emergency callouts covered evenings", body: "Burst pipes, leaks, no hot water. Same-day response within 15 miles." },
    { kind: "promo", title: "Combi boiler installs from £1,650", body: "Worcester + Vaillant, 10-year warranty, gas-safe registered. Free survey visit before quote." },
    { kind: "available", title: "Radiator swap-outs this month", body: "Old panel rads swapped for slim column or vertical. Includes power flush + system balance." },
    { kind: "job-offer", title: "Second-year apprentice welcome", body: "Days on residential jobs, mix of new-build + retrofit. Reference required." }
  ]
};
const DEFAULT_EXAMPLE_POSTS = [
  { kind: "available", title: "Recent job finished — photos on request", body: "Message us for the full portfolio + client references." },
  { kind: "available", title: "Availability this month", body: "Booking small + medium jobs. Message with what you need + a rough timeline." },
  { kind: "promo", title: "Free quote visits within 15 miles", body: "In-person survey + written quote, no obligation." },
  { kind: "chat", title: "We stand behind our work", body: "Insured, references on file, portfolio available at any time." },
  { kind: "job-offer", title: "Second pair of hands wanted for busy period", body: "Reliable, own transport preferred. Message with experience + availability." }
];

// Mock trade members pool per trade — mirrors MEMBER_POOL_BY_TRADE
// in src/lib/canteens/seed.ts. Keep in sync manually until we extract
// to a shared JSON.
const MEMBER_POOL_BY_TRADE = {
  carpentry:  ["demo-eleanor-singh-sash-window-restorer-london","demo-david-osei-door-manufacturer-birmingham","demo-ben-lawrence-stair-fitter-cambridge","demo-callum-bryce-door-fitter-bristol"],
  plastering: ["demo-emma-whitfield-plasterer-leeds","demo-charlotte-evans-insulation-installer-bristol","demo-craig-walters-bricklayer-nottingham","demo-callum-mcphee-roofing-supplies-belfast"],
  plumbing:   ["demo-dave-thornton-plumber-sheffield","demo-craig-donnelly-plumbing-merchant-glasgow","demo-james-holt-plumber-nottingham","demo-craig-mcdermott-electrician-leeds"],
  electrical: ["demo-craig-mcdermott-electrician-leeds","demo-anwar-rashid-electrical-wholesaler-birmingham","demo-anya-petrova-smart-home-installer-london","demo-james-holt-plumber-nottingham"],
  roofing:    ["demo-callum-mcphee-roofing-supplies-belfast","demo-craig-pritchard-gutter-installer-cardiff","demo-craig-walters-bricklayer-nottingham","demo-billy-ahmed-scaffolder-birmingham"],
  bricklaying:["demo-craig-walters-bricklayer-nottingham","demo-dean-foster-brickwork-liverpool","demo-darren-mccormack-groundworker-belfast","demo-callum-mcphee-roofing-supplies-belfast"],
  landscaping:["demo-ben-fairhurst-fencing-installer-norwich","demo-charlie-armstrong-heavy-machinery-aberdeen","demo-darren-okonkwo-waste-removal-nottingham","demo-craig-buchanan-demolition-glasgow"],
  tiling:     ["demo-anya-petrova-tiler-bristol","demo-francesca-de-luca-tile-shop-london","demo-charlotte-evans-insulation-installer-bristol","demo-craig-donnelly-plumbing-merchant-glasgow"]
};
const DEFAULT_MEMBER_POOL = ["demo-aaron-hughes-builder-sheffield","demo-craig-mcdermott-electrician-leeds","demo-emma-whitfield-plasterer-leeds","demo-callum-mcphee-roofing-supplies-belfast"];

const CANTEEN_CHAT_SNIPPETS = {
  carpentry: [
    "Anyone got a source for kiln-dried European oak in 50mm? Local yard's gone up 12% this quarter.",
    "Just finished a walnut staircase — dovetailed treads throughout. Client wants me to do their study next.",
    "What's everyone charging for hanging bespoke internal doors these days? £180 fitted feels light.",
    "Second-fix job in Nottingham needs a hand next Wednesday — day rate agreed if anyone's local + free.",
    "Festool TS55 for sale, mint condition, all accessories + rail. £280 collected Manchester."
  ],
  plastering: [
    "Silicone render on a warm day — bought it in a mist coat 30 mins later, brilliant.",
    "Anyone else been getting bad batches of Multi lately? Setting way too fast, all suppliers same story.",
    "Skimmed a full house in 3 days last week solo. Two coats + PVA. Ceilings included.",
    "Renderer wanted for a 4-day external in Leeds week after next. Cash paid Fridays.",
    "Best price I've found on 1200×2400 plasterboard is at Wickes Trade this month, £11.20."
  ],
  plumbing: [
    "First Fischer Ecotronic install today, took 40 mins. Wondering why I've been using the old ones.",
    "Ideal Logic dying on me at 4 years old — anyone had this? Third one this year.",
    "Boiler + full radiator upgrade in Manchester needs a second Gas-Safe next Monday, £180 day rate.",
    "Copper is cheaper again this month. Trade counter has 15mm at £2.35/m collected.",
    "Doing more UFH now than combis, honestly. Anyone else seeing the switch?"
  ]
};
const DEFAULT_CANTEEN_SNIPPETS = [
  "Anyone else finding merchants pushing prices up mid-quarter? Third one this month.",
  "Booked solid to end of the month, might have space for a small job late July if anyone's asking.",
  "New tool arrived today. Not sure if it's better than the old one yet — reports in a week.",
  "Second pair of hands wanted for 2 days this week. Reliable + own transport, cash paid daily.",
  "Trade discount at the wholesaler on Fridays is genuinely worth changing your day for."
];

async function resolveMemberSummaries(slugs) {
  if (slugs.length === 0) return [];
  const res = await supa.from("hammerex_trade_off_listings").select("slug, display_name, primary_trade, city, avatar_url").in("slug", slugs);
  return res.data ?? [];
}

async function seedCanteen({ canteenSlug, tradeSlug, listingId }) {
  const current = await supa.from("hammerex_canteens").select("id, header_bg_url").eq("slug", canteenSlug).maybeSingle();
  if (!current.data) return { heroSet: false, membersInserted: 0, canteenPostsInserted: 0, yardPostsInserted: 0, error: "canteen-not-found" };
  const canteenId = current.data.id;

  // 1. HERO
  let heroSet = false;
  if (!current.data.header_bg_url) {
    const url = pickHeroForTrade(tradeSlug);
    if (url) {
      await supa.from("hammerex_canteens").update({ header_bg_url: url }).eq("slug", canteenSlug);
      heroSet = true;
    }
  }

  // 2. MEMBERS
  const memberCountRes = await supa.from("hammerex_canteen_members").select("id", { count: "exact", head: true }).eq("canteen_id", canteenId);
  const currentMembers = memberCountRes.count ?? 0;
  let membersInserted = 0;
  let seededMemberSummaries = [];
  if (currentMembers <= 1) {
    const pool = MEMBER_POOL_BY_TRADE[tradeSlug] ?? DEFAULT_MEMBER_POOL;
    seededMemberSummaries = await resolveMemberSummaries(pool);
    if (seededMemberSummaries.length > 0) {
      const rows = seededMemberSummaries.map((m) => ({
        canteen_id:   canteenId,
        member_slug:  m.slug,
        display_name: m.display_name,
        trade_label:  m.primary_trade ?? "trade",
        city:         m.city ?? null,
        avatar_url:   m.avatar_url ?? null,
        role:         "member"
      }));
      const ins = await supa.from("hammerex_canteen_members").insert(rows).select("id");
      membersInserted = ins.data?.length ?? 0;
    }
  } else {
    const existing = await supa.from("hammerex_canteen_members").select("member_slug, display_name, avatar_url").eq("canteen_id", canteenId).neq("role", "admin").limit(4);
    seededMemberSummaries = (existing.data ?? []).map((r) => ({ slug: r.member_slug, display_name: r.display_name, avatar_url: r.avatar_url ?? null }));
  }

  // 3. CANTEEN POSTS
  let canteenPostsInserted = 0;
  if (seededMemberSummaries.length > 0) {
    const existing = await supa.from("hammerex_canteen_posts").select("id").eq("canteen_id", canteenId).eq("is_sample", true).limit(1);
    if ((existing.data?.length ?? 0) === 0) {
      const snippets = CANTEEN_CHAT_SNIPPETS[tradeSlug] ?? DEFAULT_CANTEEN_SNIPPETS;
      const now = Date.now();
      const rows = snippets.map((body, i) => {
        const author = seededMemberSummaries[i % seededMemberSummaries.length];
        return {
          canteen_id:          canteenId,
          author_slug:         author.slug,
          author_display_name: author.display_name,
          author_avatar_url:   author.avatar_url ?? null,
          kind:                "chat",
          body,
          is_sample:           true,
          status:              "live",
          created_at:          new Date(now - (snippets.length - i) * 3600 * 1000).toISOString()
        };
      });
      const ins = await supa.from("hammerex_canteen_posts").insert(rows).select("id");
      canteenPostsInserted = ins.data?.length ?? 0;
    }
  }

  // 4. YARD POSTS
  let yardPostsInserted = 0;
  if (listingId) {
    const existing = await supa.from("hammerex_trade_off_yard_posts").select("id").eq("listing_id", listingId).eq("is_sample", true).limit(1);
    if ((existing.data?.length ?? 0) === 0) {
      const posts = TRADE_EXAMPLE_POSTS[tradeSlug] ?? DEFAULT_EXAMPLE_POSTS;
      const now = Date.now();
      const rows = posts.map((p, i) => ({
        listing_id:        listingId,
        kind:              p.kind,
        trade_slug:        tradeSlug,
        title:             p.title,
        body:              p.body,
        is_sample:         true,
        status:            "live",
        moderation_status: "live",
        created_at: new Date(now - (posts.length - i) * 3600 * 1000).toISOString()
      }));
      const ins = await supa.from("hammerex_trade_off_yard_posts").insert(rows).select("id");
      yardPostsInserted = ins.data?.length ?? 0;
    }
  }

  return { heroSet, membersInserted, canteenPostsInserted, yardPostsInserted };
}

async function main() {
  const canteens = await supa.from("hammerex_canteens").select("slug, trade_slug, header_bg_url");
  if (canteens.error) throw canteens.error;
  const listings = await supa.from("hammerex_trade_off_listings").select("id, slug");
  if (listings.error) throw listings.error;
  const slugToListingId = new Map(listings.data.map((l) => [l.slug, l.id]));

  let heroSetCount = 0;
  let membersCount = 0;
  let canteenPostsCount = 0;
  let yardPostsCount = 0;
  for (const c of canteens.data) {
    if (!c.trade_slug) { console.log(`[${c.slug}] SKIP no trade_slug`); continue; }
    const listingId = slugToListingId.get(c.slug) ?? null;
    const res = await seedCanteen({ canteenSlug: c.slug, tradeSlug: c.trade_slug, listingId });
    if (res.heroSet) heroSetCount++;
    membersCount      += res.membersInserted;
    canteenPostsCount += res.canteenPostsInserted;
    yardPostsCount    += res.yardPostsInserted;
    console.log(`[${c.slug}] hero=${res.heroSet ? "set" : "kept"} members=+${res.membersInserted} canteenPosts=+${res.canteenPostsInserted} yardPosts=+${res.yardPostsInserted} listing=${listingId ?? "—"}${res.error ? " ERR " + res.error : ""}`);
  }
  console.log(`\nDone. ${heroSetCount} heroes set, ${membersCount} members added, ${canteenPostsCount} canteen posts, ${yardPostsCount} yard posts.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
