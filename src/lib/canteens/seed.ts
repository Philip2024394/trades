// Canteen seeding — hero banner + 4 mock trade members + 5 canteen posts.
//
// Rule (Philip 2026-07-20): every canteen must never look empty. On
// creation we:
//   1. Pick a trade-appropriate hero banner from the hero library
//      (if the merchant didn't provide one).
//   2. Add 4 mock trade members from the demo pool to
//      hammerex_canteen_members — populates the left-column members
//      inbox on the canteen page.
//   3. Insert 5 example canteen posts into hammerex_canteen_posts
//      (is_sample=true) attributed to those 4 mock members round-robin,
//      so the canteen feed looks like a live conversation. Amber
//      "Example" pill labels each post honestly.
//   4. Also seed 5 example yard posts against the merchant's own
//      listing (yard-side network activity).
//
// Auto-decay: when the merchant publishes a real canteen post, the
// oldest is_sample=true canteen post is soft-hidden. Same for yard.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pickHeroForTrade } from "@/lib/heroLibrary";

// ─── EXAMPLE YARD POSTS ────────────────────────────────────────────────

// `kind` must match the CHECK constraint on hammerex_trade_off_yard_posts.kind:
//   available | needed | chat | product | job-seek | job-offer
//   collab-help | tools-sell | tools-buy | tools-rent
//   materials-surplus | abroad-job | promo | beacon
type YardPostKind = "available" | "needed" | "chat" | "product" | "job-seek" | "job-offer"
  | "collab-help" | "tools-sell" | "tools-buy" | "tools-rent"
  | "materials-surplus" | "abroad-job" | "promo" | "beacon";
type ExamplePost = { title: string; body: string; kind: YardPostKind };

export const TRADE_EXAMPLE_POSTS: Record<string, ExamplePost[]> = {
  carpentry: [
    { kind: "available",         title: "Bespoke oak staircase finished this week", body: "Hand-cut treads, dovetailed newel posts, hand-rubbed oil finish. Full photo set on request." },
    { kind: "materials-surplus", title: "Reclaimed pitch pine flooring available", body: "12m² of 150mm-wide reclaimed pitch pine, 22mm thick. Great for period property renovation." },
    { kind: "available",         title: "Kitchen cabinet doors made to spec", body: "Solid oak or painted MDF. Any profile — shaker, slab, beaded. Sample on request before order." },
    { kind: "chat",              title: "On-site fitting week starts Monday", body: "Two full days available for wardrobe or built-in fitting jobs. Message for quote." },
    { kind: "job-offer",         title: "Looking for a second joiner on a large kitchen fit", body: "3-day job starting next Tuesday, day rate agreed. Own tools + van essential." }
  ],
  plastering: [
    { kind: "available", title: "Full house re-skim finished this week", body: "3-bed semi, ceilings and walls throughout. Clean site, dust extraction used, ready for decoration Friday." },
    { kind: "available", title: "External render available for summer", body: "Silicone-modified render, K-rend and Weber approved installer. Colour matched to sample." },
    { kind: "available", title: "Small repair jobs welcome", body: "Cracks, holes, water damage, ceiling patches. No job too small — quoted honestly, next-week turnaround." },
    { kind: "chat",      title: "Feature wall Venetian plaster demo", body: "Polished Venetian in feature colours. Sample panel on request before booking." },
    { kind: "job-offer", title: "Labourer wanted — mixing + hawk carrying", body: "Two days a week, cash paid daily. Learn on the job if keen." }
  ],
  plumbing: [
    { kind: "available", title: "Full bathroom refit starting Monday", body: "Copper pipework throughout, wall-hung units, thermostatic shower. Full photo set on completion." },
    { kind: "available", title: "Emergency callouts covered evenings", body: "Burst pipes, leaks, no hot water. Same-day response within 15 miles." },
    { kind: "promo",     title: "Combi boiler installs from £1,650", body: "Worcester + Vaillant, 10-year warranty, gas-safe registered. Free survey visit before quote." },
    { kind: "available", title: "Radiator swap-outs this month", body: "Old panel rads swapped for slim column or vertical. Includes power flush + system balance." },
    { kind: "job-offer", title: "Second-year apprentice welcome", body: "Days on residential jobs, mix of new-build + retrofit. Reference required." }
  ],
  electrical: [
    { kind: "available", title: "Full rewire completed on 4-bed semi", body: "New consumer unit, RCBOs throughout, minimum-disruption cable routing. EICR + install cert issued." },
    { kind: "available", title: "EV charger installs available", body: "Zappi + Ohme + Podpoint. OZEV grant handled. 3-hour install, most jobs same-day." },
    { kind: "available", title: "Smart-home lighting design", body: "Lutron / Rako install + programming. Free plan-visit before quote." },
    { kind: "promo",     title: "PAT testing for landlords + offices", body: "Bulk-rate for 20+ items. Digital cert issued same-day, HMRC-compliant." },
    { kind: "job-offer", title: "Electrician's mate wanted for 6-week job", body: "Cable pulls + first fix on a small commercial refit. Own PPE." }
  ],
  roofing: [
    { kind: "available", title: "Slate roof strip + re-cover finished", body: "Welsh natural slate on breathable membrane, lead flashing to all abutments. 25-year workmanship warranty." },
    { kind: "available", title: "Gutter clean + inspection service", body: "Vac from ground up to 3 storeys, video inspection included, fix minor leaks on the day." },
    { kind: "available", title: "Flat-roof replacements — GRP + EPDM", body: "20-year system warranty, most single-storey extensions done in a day. Free quote." },
    { kind: "available", title: "Chimney repointing available", body: "Weathered joints raked out + re-pointed in NHL mortar. Colour-matched to existing." },
    { kind: "job-offer", title: "Second roofer on a large re-tile", body: "10-day job, day rate agreed, own harness + PPE required." }
  ],
  bricklaying: [
    { kind: "available", title: "Feature-brick porch finished", body: "Reclaimed reds laid in Flemish bond, arched head with tapered voussoirs. Photos on request." },
    { kind: "available", title: "Garden wall builds — quotes given free", body: "Any length, brick or block, foundation dug + poured, coping stones fitted. Free site visit." },
    { kind: "available", title: "Extension shell built to plate height", body: "Two-storey side extension, cavity work, insulated. 4-week build, on-time completion." },
    { kind: "available", title: "Chimney rebuild above roof line", body: "Brick match sourced, lead tray + flashings fitted. Sign-off by NHBC surveyor." },
    { kind: "job-offer", title: "Hod carrier / labourer for 3-week job", body: "Domestic extension, brick pointing + clean-up daily. Day rate paid Fridays." }
  ],
  landscaping: [
    { kind: "available", title: "Full garden design + build finished", body: "Sandstone patio, oak sleeper raised beds, cedar pergola. Client walkthrough this Saturday." },
    { kind: "available", title: "Turf laying + soil prep", body: "Rotivate, level, blend topsoil, lay premium rye turf. £8/m² fitted, minimum 50m²." },
    { kind: "available", title: "Fencing panels + posts supplied fitted", body: "Featheredge, closeboard, or slatted contemporary. Postcrete + capping included." },
    { kind: "available", title: "Driveway resurfacing in resin-bound", body: "Permeable, SUDS-compliant, 20-year lifespan. Free site survey + design proposal." },
    { kind: "job-offer", title: "Second gardener for maintenance rounds", body: "Wednesdays + Thursdays, 8-4, own boots + gloves. Mowing / hedging / weeding rounds." }
  ],
  tiling: [
    { kind: "available", title: "Bathroom porcelain tile job finished", body: "Large-format 600×1200 rectified porcelain, mitred corners, epoxy grout. 3-day turnaround." },
    { kind: "available", title: "Wet-room specialist installs", body: "Fully tanked wet-room floors, gradient shower drains, seamless finish to walls." },
    { kind: "available", title: "Kitchen splashback next-week slots", body: "Marble-effect, subway, or bespoke. Cut-in around sockets + hobs. 1-day fit." },
    { kind: "promo",     title: "Underfloor heating + tile packages", body: "Warmup + Prowarm systems, screed included. From £75/m² all-in." },
    { kind: "job-offer", title: "Tiler's mate wanted for 2-week job", body: "Setting out + adhesive mixing, own knee pads + basic tools." }
  ]
};

export const DEFAULT_EXAMPLE_POSTS: ExamplePost[] = [
  { kind: "available", title: "Recent job finished — photos on request", body: "Message us for the full portfolio + client references." },
  { kind: "available", title: "Availability this month", body: "Booking small + medium jobs. Message with what you need + a rough timeline." },
  { kind: "promo",     title: "Free quote visits within 15 miles", body: "In-person survey + written quote, no obligation." },
  { kind: "chat",      title: "We stand behind our work", body: "Insured, references on file, portfolio available at any time." },
  { kind: "job-offer", title: "Second pair of hands wanted for busy period", body: "Reliable, own transport preferred. Message with experience + availability." }
];

// ─── EXAMPLE CANTEEN POSTS ─────────────────────────────────────────────
//
// Short conversational snippets that read as normal member chatter.
// Each canteen gets 5 of these attributed round-robin to its 4 seeded
// members. Same "Example" pill treatment as yard-side samples.

type CanteenChatSnippet = { body: string };

const CANTEEN_CHAT_SNIPPETS: Record<string, CanteenChatSnippet[]> = {
  carpentry: [
    { body: "Anyone got a source for kiln-dried European oak in 50mm? Local yard's gone up 12% this quarter." },
    { body: "Just finished a walnut staircase — dovetailed treads throughout. Client wants me to do their study next." },
    { body: "What's everyone charging for hanging bespoke internal doors these days? £180 fitted feels light." },
    { body: "Second-fix job in Nottingham needs a hand next Wednesday — day rate agreed if anyone's local + free." },
    { body: "Festool TS55 for sale, mint condition, all accessories + rail. £280 collected Manchester." }
  ],
  plastering: [
    { body: "Silicone render on a warm day — bought it in a mist coat 30 mins later, brilliant." },
    { body: "Anyone else been getting bad batches of Multi lately? Setting way too fast, all suppliers same story." },
    { body: "Skimmed a full house in 3 days last week solo. Two coats + PVA. Ceilings included." },
    { body: "Renderer wanted for a 4-day external in Leeds week after next. Cash paid Fridays." },
    { body: "Best price I've found on 1200×2400 plasterboard is at Wickes Trade this month, £11.20." }
  ],
  plumbing: [
    { body: "First Fischer Ecotronic install today, took 40 mins. Wondering why I've been using the old ones." },
    { body: "Ideal Logic dying on me at 4 years old — anyone had this? Third one this year." },
    { body: "Boiler + full radiator upgrade in Manchester needs a second Gas-Safe next Monday, £180 day rate." },
    { body: "Copper is cheaper again this month. Trade counter has 15mm at £2.35/m collected." },
    { body: "Doing more UFH now than combis, honestly. Anyone else seeing the switch?" }
  ],
  electrical: [
    { body: "New Fusebox Enterprise consumer units are so much better than the Chint knockoffs, worth the £40 extra." },
    { body: "18th Amendment 3 update — anyone got a copy of the exam questions? Booked for August." },
    { body: "EV charger install in Sheffield needs a mate for the day — cable pull only, £150 flat." },
    { body: "Testing kit hire from a merchant vs buying outright — anyone got a spreadsheet?" },
    { body: "Job priced at £2,200. Customer wants me to knock £400 off for cash. Feels dodgy." }
  ],
  roofing: [
    { body: "Spanish slate keeps drifting up. Welsh natural's back within £120/1000 now — worth the switch back." },
    { body: "GRP flat roof over a bay window in Cardiff Wednesday if anyone wants a straight day." },
    { body: "Anyone using dry ridge systems now vs mortar? Client asked and I couldn't give a proper answer." },
    { body: "Lead flashings prices are insane again. Switching to code 5 alternatives where I can." },
    { body: "10 boxes of Sandtoft interlocking pantiles, unopened, £22/box collected Newcastle." }
  ],
  bricklaying: [
    { body: "Reclaimed London stocks on a period job in Islington. Anyone got a good yard in the SE?" },
    { body: "Hod carrier free from Thursday if anyone needs one for a couple of weeks — Yorkshire." },
    { body: "NHL 3.5 mortar on a solid-wall Victorian, first time. Weather turned so covered it up quick." },
    { body: "New Marshalltown line pins — best £14 I've spent this year. No more twisted string." },
    { body: "Prices on Ibstock reds up again. Wienerberger cheaper this quarter if you can wait 4 weeks." }
  ],
  landscaping: [
    { body: "Marshalls Fairstone sandstone in silver birch — client loved it, laid dry to a lime bed. Photos on request." },
    { body: "Cedar cladding for a 3m×3m garden studio, best supplier in the Midlands? Local yard's dry." },
    { body: "Anyone using resin-bound on driveways? Getting more asks. Kit + training worth it?" },
    { body: "Turf laying Thursday if anyone has a mate to swing a wheelbarrow — Leeds LS7." },
    { body: "Postcrete keeps going up. Bulk bag concrete + adder cheaper if you can mix on site." }
  ],
  tiling: [
    { body: "1200×600 rectified porcelain onto plasterboard — Ardex X7G or F1? Trying both this month." },
    { body: "Bathroom in Bristol needs a second tiler Wednesday for a splashback + floor, day rate £180." },
    { body: "Best cheap wet saw for occasional use? Rubi's overkill for small jobs." },
    { body: "Anti-fracture matting on tongue-and-groove floors — worth it? Or just prime and go?" },
    { body: "Karndean vs Amtico for a kitchen with UFH — anyone had shrinkage issues?" }
  ]
};

const DEFAULT_CANTEEN_CHAT_SNIPPETS: CanteenChatSnippet[] = [
  { body: "Anyone else finding merchants pushing prices up mid-quarter? Third one this month." },
  { body: "Booked solid to end of the month, might have space for a small job late July if anyone's asking." },
  { body: "New tool arrived today. Not sure if it's better than the old one yet — reports in a week." },
  { body: "Second pair of hands wanted for 2 days this week. Reliable + own transport, cash paid daily." },
  { body: "Trade discount at the wholesaler on Fridays is genuinely worth changing your day for." }
];

// ─── MOCK MEMBERS POOL ─────────────────────────────────────────────────
//
// For each canteen trade, we seed 4 members drawn from a curated set
// of demo trade slugs. The pool is trade-adjacent — a plasterer sees
// a decorator, drywall specialist, painter, plaster supplier as peers,
// not other plasterers competing head-to-head.

const MEMBER_POOL_BY_TRADE: Record<string, string[]> = {
  carpentry: [
    "demo-eleanor-singh-sash-window-restorer-london",
    "demo-david-osei-door-manufacturer-birmingham",
    "demo-ben-lawrence-stair-fitter-cambridge",
    "demo-callum-bryce-door-fitter-bristol"
  ],
  plastering: [
    "demo-emma-whitfield-plasterer-leeds",
    "demo-charlotte-evans-insulation-installer-bristol",
    "demo-craig-walters-bricklayer-nottingham",
    "demo-callum-mcphee-roofing-supplies-belfast"
  ],
  plumbing: [
    "demo-dave-thornton-plumber-sheffield",
    "demo-craig-donnelly-plumbing-merchant-glasgow",
    "demo-james-holt-plumber-nottingham",
    "demo-craig-mcdermott-electrician-leeds"
  ],
  electrical: [
    "demo-craig-mcdermott-electrician-leeds",
    "demo-anwar-rashid-electrical-wholesaler-birmingham",
    "demo-anya-petrova-smart-home-installer-london",
    "demo-james-holt-plumber-nottingham"
  ],
  roofing: [
    "demo-callum-mcphee-roofing-supplies-belfast",
    "demo-craig-pritchard-gutter-installer-cardiff",
    "demo-craig-walters-bricklayer-nottingham",
    "demo-billy-ahmed-scaffolder-birmingham"
  ],
  bricklaying: [
    "demo-craig-walters-bricklayer-nottingham",
    "demo-dean-foster-brickwork-liverpool",
    "demo-darren-mccormack-groundworker-belfast",
    "demo-callum-mcphee-roofing-supplies-belfast"
  ],
  landscaping: [
    "demo-ben-fairhurst-fencing-installer-norwich",
    "demo-charlie-armstrong-heavy-machinery-aberdeen",
    "demo-darren-okonkwo-waste-removal-nottingham",
    "demo-craig-buchanan-demolition-glasgow"
  ],
  tiling: [
    "demo-anya-petrova-tiler-bristol",
    "demo-francesca-de-luca-tile-shop-london",
    "demo-charlotte-evans-insulation-installer-bristol",
    "demo-craig-donnelly-plumbing-merchant-glasgow"
  ]
};

const DEFAULT_MEMBER_POOL: string[] = [
  "demo-aaron-hughes-builder-sheffield",
  "demo-craig-mcdermott-electrician-leeds",
  "demo-emma-whitfield-plasterer-leeds",
  "demo-callum-mcphee-roofing-supplies-belfast"
];

type MemberSummary = {
  slug: string;
  display_name: string;
  primary_trade: string | null;
  city: string | null;
  avatar_url: string | null;
};

async function resolveMemberSummaries(slugs: string[]): Promise<MemberSummary[]> {
  if (slugs.length === 0) return [];
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, primary_trade, city, avatar_url")
    .in("slug", slugs);
  return (res.data as MemberSummary[]) ?? [];
}

// ─── SEED FUNCTIONS ────────────────────────────────────────────────────

/** Seed a canteen with hero + 4 mock trade members + 5 canteen posts
 *  + 5 yard posts. Idempotent — each step skips if already done. */
export async function seedCanteenExamples(input: {
  canteenSlug:   string;
  tradeSlug:     string;
  listingId:     string | null;    // yard posts require a listing_id FK
  overwriteHero?: boolean;
}): Promise<{
  ok: boolean;
  heroSet: boolean;
  membersInserted: number;
  canteenPostsInserted: number;
  yardPostsInserted: number;
  error?: string;
}> {
  const canteenRow = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, header_bg_url")
    .eq("slug", input.canteenSlug)
    .maybeSingle();
  if (!canteenRow.data) {
    return {
      ok: false, heroSet: false, membersInserted: 0, canteenPostsInserted: 0, yardPostsInserted: 0,
      error: "canteen-not-found"
    };
  }
  const canteenId = canteenRow.data.id as string;

  // 1. HERO — write auto-picked banner if canteen has none.
  let heroSet = false;
  if (!canteenRow.data.header_bg_url || input.overwriteHero) {
    const hero = pickHeroForTrade(input.tradeSlug);
    if (hero?.image_url) {
      await supabaseAdmin
        .from("hammerex_canteens")
        .update({ header_bg_url: hero.image_url })
        .eq("slug", input.canteenSlug);
      heroSet = true;
    }
  }

  // 2. MEMBERS — seed 4 mock trade members if the canteen has ≤ 1
  //    member (the owner). Skip if members already exist.
  const memberCount = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("id", { count: "exact", head: true })
    .eq("canteen_id", canteenId);
  const currentMembers = memberCount.count ?? 0;
  let membersInserted = 0;
  let seededMemberSummaries: MemberSummary[] = [];
  if (currentMembers <= 1) {
    const pool = MEMBER_POOL_BY_TRADE[input.tradeSlug] ?? DEFAULT_MEMBER_POOL;
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
      const ins = await supabaseAdmin
        .from("hammerex_canteen_members")
        .insert(rows)
        .select("id");
      membersInserted = ins.data?.length ?? 0;
    }
  } else {
    // Even if we're not inserting, resolve summaries of the first 4
    // non-admin members so we can attribute canteen posts to real
    // author slugs.
    const existing = await supabaseAdmin
      .from("hammerex_canteen_members")
      .select("member_slug, display_name, avatar_url")
      .eq("canteen_id", canteenId)
      .neq("role", "admin")
      .limit(4);
    seededMemberSummaries = (existing.data ?? []).map((r) => ({
      slug: r.member_slug as string,
      display_name: r.display_name as string,
      primary_trade: null,
      city: null,
      avatar_url: (r.avatar_url as string | null) ?? null
    }));
  }

  // 3. CANTEEN POSTS — 5 chat-kind samples attributed round-robin to
  //    the seeded members. Skip if any sample already exists.
  let canteenPostsInserted = 0;
  if (seededMemberSummaries.length > 0) {
    const existingSamples = await supabaseAdmin
      .from("hammerex_canteen_posts")
      .select("id")
      .eq("canteen_id", canteenId)
      .eq("is_sample", true)
      .limit(1);
    if ((existingSamples.data?.length ?? 0) === 0) {
      const snippets = CANTEEN_CHAT_SNIPPETS[input.tradeSlug] ?? DEFAULT_CANTEEN_CHAT_SNIPPETS;
      const now = Date.now();
      const rows = snippets.map((snip, i) => {
        const author = seededMemberSummaries[i % seededMemberSummaries.length];
        return {
          canteen_id:          canteenId,
          author_slug:         author.slug,
          author_display_name: author.display_name,
          author_avatar_url:   author.avatar_url ?? null,
          kind:                "chat",
          body:                snip.body,
          is_sample:           true,
          status:              "live",
          created_at:          new Date(now - (snippets.length - i) * 3600 * 1000).toISOString()
        };
      });
      const ins = await supabaseAdmin
        .from("hammerex_canteen_posts")
        .insert(rows)
        .select("id");
      canteenPostsInserted = ins.data?.length ?? 0;
    }
  }

  // 4. YARD POSTS — 5 samples against the owner's listing (network
  //    activity). Requires listing_id + no existing samples.
  let yardPostsInserted = 0;
  if (input.listingId) {
    const existingYard = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("id")
      .eq("listing_id", input.listingId)
      .eq("is_sample", true)
      .limit(1);
    if ((existingYard.data?.length ?? 0) === 0) {
      const posts = TRADE_EXAMPLE_POSTS[input.tradeSlug] ?? DEFAULT_EXAMPLE_POSTS;
      const now = Date.now();
      const rows = posts.map((p, i) => ({
        listing_id:        input.listingId,
        kind:              p.kind,
        trade_slug:        input.tradeSlug,
        title:             p.title,
        body:              p.body,
        is_sample:         true,
        status:            "live",
        moderation_status: "live",
        created_at: new Date(now - (posts.length - i) * 3600 * 1000).toISOString()
      }));
      const ins = await supabaseAdmin
        .from("hammerex_trade_off_yard_posts")
        .insert(rows)
        .select("id");
      yardPostsInserted = ins.data?.length ?? 0;
    }
  }

  return {
    ok: true,
    heroSet,
    membersInserted,
    canteenPostsInserted,
    yardPostsInserted
  };
}

/** Called by the yard-post-create endpoint after a merchant publishes
 *  a real yard post. Auto-decay for yard samples. Never throws. */
export async function pruneOneExamplePost(listingId: string): Promise<void> {
  try {
    const oldest = await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .select("id")
      .eq("listing_id", listingId)
      .eq("is_sample", true)
      .eq("moderation_status", "live")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!oldest.data) return;
    await supabaseAdmin
      .from("hammerex_trade_off_yard_posts")
      .update({
        moderation_status: "hidden",
        moderated_at:      new Date().toISOString(),
        moderation_reason: "auto-decay: real post published"
      })
      .eq("id", oldest.data.id);
  } catch (err) {
    console.error("[canteens/seed] pruneOneExamplePost failed:", err);
  }
}

/** Called by the canteen-post-create endpoint. Auto-decay for canteen
 *  samples. Never throws. */
export async function pruneOneExampleCanteenPost(canteenId: string): Promise<void> {
  try {
    const oldest = await supabaseAdmin
      .from("hammerex_canteen_posts")
      .select("id")
      .eq("canteen_id", canteenId)
      .eq("is_sample", true)
      .eq("status", "live")
      .is("moderation_hidden_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!oldest.data) return;
    await supabaseAdmin
      .from("hammerex_canteen_posts")
      .update({
        moderation_hidden_at:     new Date().toISOString(),
        moderation_hidden_reason: "auto-decay: real post published"
      })
      .eq("id", oldest.data.id);
  } catch (err) {
    console.error("[canteens/seed] pruneOneExampleCanteenPost failed:", err);
  }
}
