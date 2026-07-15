// Server-side canteens reader. Same fallback pattern as reviews.server.ts:
// real DB read first, mock fallback when the DB has nothing (early
// lifecycle, migration window, or transient DB error).
//
// Shapes rows into the existing Canteen / CanteenMember / CanteenProduct
// types so consumers (CanteenPageShell, CanteenProfileFocus, Trade
// Center, Notebook, Reviews page) stay unchanged.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Canteen, CanteenMember, CanteenProduct, CanteenDesign, SideLanePost, BrowseProductRow, BrowseSort } from "@/lib/canteens";
import { adminWhatsapp } from "@/lib/whatsapp";
import {
  canteenBySlug as canteenBySlugMock,
  membersForCanteen as membersForCanteenMock,
  adminForCanteen as adminForCanteenMock,
  productsForCanteen as productsForCanteenMock,
  canteenProductById as canteenProductByIdMock,
  designsForCanteen as designsForCanteenMock,
  canteenHostedByMerchant as canteenHostedByMerchantMock,
  canteenBannerForMerchant as canteenBannerForMerchantMock,
  platformSideLane as platformSideLaneMock,
  browseAllProducts as browseAllProductsMock,
  browseTradeFacets as browseTradeFacetsMock
} from "@/lib/canteens";

// ─── Demo-safe WhatsApp substitution ───────────────────────
//
// When a user clicks the WhatsApp button on a DEMO canteen (host slug
// starts with `demo-`), we route the click to the Networkers support
// WhatsApp instead of the fake per-demo number. Users never see a
// mock number and clicks reach a real inbox that can respond with
// "you're previewing a demo — set up your own canteen at ...".
//
// Applied at the loader boundary so every consumer (admin card,
// WhatsApp button, business card modal, contact page) automatically
// gets the substitution — no per-component logic needed.
function demoSafeMember(member: CanteenMember | null): CanteenMember | null {
  if (!member) return member;
  if (member.slug?.startsWith("demo-")) {
    return { ...member, whatsapp: adminWhatsapp() };
  }
  return member;
}

function demoSafeMembers(members: CanteenMember[]): CanteenMember[] {
  return members.map((m) => demoSafeMember(m)!).filter(Boolean);
}

// Mock canteens use non-UUID ids like "cant_kitchen_uk". Passing one
// through to Postgres blows up with a uuid-parse error and returns an
// empty PostgrestError object (all non-enumerable). Every DB reader
// that takes a canteenId guards on this and short-circuits to mock so
// the downstream page stays live during the migration window.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

// ─── Canteen lookup ───────────────────────────────────────

export async function canteensAllFromDb(limit: number = 200): Promise<Canteen[]> {
  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, slug, name, tagline, trade_slug, trade_label, host_slug, host_display_name, member_count, posts_last_30d, activity_streak_months, header_bg_url, created_at, is_founding_100")
    .order("posts_last_30d", { ascending: false })
    .limit(limit);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] canteensAll", res.error);
    return [];
  }
  return (res.data ?? []).map((r) => shapeCanteen(r));
}

export async function canteenBySlugFromDb(slug: string): Promise<Canteen | null> {
  // Fixture demo canteens (uk-kitchen-fitters, uk-rated-electricians,
  // north-uk-sparks, uk-scaffolders, etc.) own their content in
  // MOCK_CANTEENS + MOCK_CANTEEN_MEMBERS. Any DB row for these slugs is
  // a stale leftover from an earlier impersonate auto-seed and MUST be
  // ignored — DB row would return a UUID id that downstream lookups
  // (adminForCanteenFromDb, membersForCanteenFromDb) then can't map to
  // the fixture data, giving an empty canteen. Prefer mock for fixture
  // slugs; real merchant canteens still go through the DB.
  const mock = canteenBySlugMock(slug);
  if (mock && mock.hostSlug.startsWith("demo-")) return mock;

  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, slug, name, tagline, trade_slug, trade_label, host_slug, host_display_name, member_count, posts_last_30d, activity_streak_months, header_bg_url, created_at, is_founding_100")
    .eq("slug", slug)
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] canteenBySlug", res.error);
    return canteenBySlugMock(slug);
  }
  if (!res.data) return canteenBySlugMock(slug);
  return shapeCanteen(res.data);
}

// ─── Members ──────────────────────────────────────────────

export async function membersForCanteenFromDb(canteenId: string): Promise<CanteenMember[]> {
  if (!isUuid(canteenId)) return demoSafeMembers(membersForCanteenMock(canteenId));
  const res = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("*")
    .eq("canteen_id", canteenId);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] members", res.error);
    return demoSafeMembers(membersForCanteenMock(canteenId));
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return demoSafeMembers(membersForCanteenMock(canteenId));
  return demoSafeMembers(rows.map((r) => shapeMember(r)));
}

export async function adminForCanteenFromDb(canteenId: string): Promise<CanteenMember | null> {
  if (!isUuid(canteenId)) return demoSafeMember(adminForCanteenMock(canteenId));
  const res = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("*")
    .eq("canteen_id", canteenId)
    .eq("role", "admin")
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] admin", res.error);
    return demoSafeMember(adminForCanteenMock(canteenId));
  }
  if (!res.data) return demoSafeMember(adminForCanteenMock(canteenId));
  return demoSafeMember(shapeMember(res.data));
}

// ─── Products ─────────────────────────────────────────────

export async function productsForCanteenFromDb(
  canteenId: string,
  opts?: { featuredOnly?: boolean }
): Promise<CanteenProduct[]> {
  if (!isUuid(canteenId)) return productsForCanteenMock(canteenId, opts);
  let q = supabaseAdmin
    .from("hammerex_canteen_products")
    .select("*")
    .eq("canteen_id", canteenId);
  if (opts?.featuredOnly) q = q.eq("featured", true);
  const res = await q;
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] products", res.error);
    return productsForCanteenMock(canteenId, opts);
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return productsForCanteenMock(canteenId, opts);
  return rows.map((r) => shapeProduct(r));
}

/** Lookup a canteen product by its merchant-declared Trade Center
 *  listing id. Falls back to product-id lookup when the identifier
 *  doesn't match any TC listing id, so URLs from both the internal
 *  editor and the buyer-facing surfaces both resolve. */
export async function canteenProductByTradeCenterListingIdFromDb(
  tcListingId: string
): Promise<CanteenProduct | null> {
  if (!tcListingId) return null;
  const res = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("*")
    .eq("trade_center_listing_id", tcListingId)
    .eq("show_in_trade_center", true)
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] byTcListingId", res.error);
    return null;
  }
  if (res.data) return shapeProduct(res.data);
  // Not found by TC listing id — try product id as a fallback so the
  // route works from both URL styles.
  return canteenProductByIdFromDb(tcListingId);
}

/** Enrich a canteen product row with its host canteen metadata (slug,
 *  trade, display name). Used by the PDP to render the "sold by" chip
 *  + link back to the merchant's canteen. */
export async function canteenHostForProductFromDb(
  hostSlug: string
): Promise<{ canteenSlug: string; hostDisplayName: string; tradeLabel: string; whatsapp: string | null } | null> {
  if (!hostSlug) return null;
  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("slug, host_display_name, trade_label")
    .eq("host_slug", hostSlug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  // Grab whatsapp from the admin member row (same shape used elsewhere).
  const adminRes = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("whatsapp")
    .eq("member_slug", hostSlug)
    .eq("role", "admin")
    .maybeSingle();
  return {
    canteenSlug: res.data.slug,
    hostDisplayName: res.data.host_display_name,
    tradeLabel: res.data.trade_label,
    whatsapp: (adminRes.data as { whatsapp?: string | null } | null)?.whatsapp ?? null
  };
}

export async function canteenProductByIdFromDb(id: string): Promise<CanteenProduct | null> {
  // Guard against mock ids like "p1" — Supabase's id column is UUID so
  // querying with a non-UUID returns an opaque error object. Match the
  // pattern used by productsForCanteenFromDb and short-circuit to mock.
  if (!isUuid(id)) return canteenProductByIdMock(id);
  const res = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] productById", res.error);
    return canteenProductByIdMock(id);
  }
  if (!res.data) return canteenProductByIdMock(id);
  return shapeProduct(res.data);
}

// ─── Designs ─────────────────────────────────────────────
//
// Fetch merchant-editable design portfolio for a canteen. Same
// fail-safe pattern as products: mock id → mock; DB error → mock;
// empty result → mock (so Mike's demo-mode page still shows the
// hardcoded kitchen designs while we onboard him into the editor).
// The moment his first real design lands in the DB, the mock stops
// showing and real data takes over.

export async function designsForCanteenFromDb(canteenId: string): Promise<CanteenDesign[]> {
  if (!isUuid(canteenId)) return designsForCanteenMock(canteenId);
  const res = await supabaseAdmin
    .from("hammerex_canteen_designs")
    .select("*")
    .eq("canteen_id", canteenId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] designs", res.error);
    return designsForCanteenMock(canteenId);
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return designsForCanteenMock(canteenId);
  return rows.map(shapeDesign);
}

function shapeDesign(r: Record<string, unknown>): CanteenDesign {
  return {
    id:          String(r.id),
    canteenId:   String(r.canteen_id),
    ref:         String(r.ref),
    name:        String(r.name),
    tagline:     (r.tagline as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    style:       (r.style as string | null) ?? null,
    imageUrl:    String(r.image_url),
    galleryUrls: (Array.isArray(r.gallery_urls) ? r.gallery_urls : []) as string[],
    sortOrder:   Number(r.sort_order ?? 0),
    createdAt:   String(r.created_at)
  };
}

// ─── Merchant helpers ─────────────────────────────────────

export async function canteenHostedByMerchantFromDb(merchantSlug: string): Promise<string | null> {
  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("slug")
    .eq("host_slug", merchantSlug)
    .limit(1)
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] canteenHostedByMerchant", res.error);
    return canteenHostedByMerchantMock(merchantSlug);
  }
  return res.data?.slug ?? canteenHostedByMerchantMock(merchantSlug);
}

export async function canteenBannerForMerchantFromDb(merchantSlug: string): Promise<string | null> {
  const res = await supabaseAdmin
    .from("hammerex_canteens")
    .select("header_bg_url")
    .eq("host_slug", merchantSlug)
    .limit(1)
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] canteenBannerForMerchant", res.error);
    return canteenBannerForMerchantMock(merchantSlug);
  }
  return res.data?.header_bg_url ?? canteenBannerForMerchantMock(merchantSlug);
}

// ─── Canteen chat feed — top-level posts ──────────────────
//
// Reads top-level posts (parent_id IS NULL) for a canteen. Falls
// back to the shell's built-in mock feed when the DB has nothing.

export type CanteenChatPost = {
  id: string;
  authorSlug: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  photoUrls: string[];
  moodSlug: string | null;
  reactionsLike: number;
  reactionsAgree: number;
  reactionsQuestion: number;
  replyCount: number;
  createdAt: string;
};

export async function canteenPostsFromDb(canteenId: string, limit: number = 30): Promise<CanteenChatPost[]> {
  if (!isUuid(canteenId)) return [];
  const res = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, author_slug, author_display_name, author_avatar_url, body, photo_urls, mood_slug, reactions, reply_count, created_at")
    .eq("canteen_id", canteenId)
    .eq("status", "live")
    .is("parent_id", null)
    .in("kind", ["chat", "question", "showcase", "announcement"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] canteenPosts", res.error);
    return [];
  }
  return (res.data ?? []).map((r) => shapePost(r));
}

/** Which top-level posts in a canteen has this saver bookmarked?
 *  Powers the initial saved-state hydration on the feed shell so the
 *  "Saved" pill + BookmarkCheck menu label render correctly on first
 *  paint, without a client round-trip. Empty set for guests or when
 *  the saver has no bookmarks. */
export async function canteenSavedPostIdsFromDb(
  canteenId: string,
  saverSlug: string | null
): Promise<string[]> {
  if (!saverSlug || !isUuid(canteenId)) return [];
  const res = await supabaseAdmin
    .from("hammerex_canteen_saved_posts")
    .select("post_id")
    .eq("canteen_id", canteenId)
    .eq("saver_slug", saverSlug);
  if (res.error || !res.data) return [];
  return res.data.map((r) => r.post_id as string).filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapePost(r: any): CanteenChatPost {
  const reactions = (r.reactions ?? {}) as { like?: number; agree?: number; question?: number };
  return {
    id: r.id,
    authorSlug: r.author_slug,
    authorDisplayName: r.author_display_name,
    authorAvatarUrl: r.author_avatar_url ?? null,
    body: r.body ?? "",
    photoUrls: (r.photo_urls ?? []) as string[],
    moodSlug: r.mood_slug ?? null,
    reactionsLike: reactions.like ?? 0,
    reactionsAgree: reactions.agree ?? 0,
    reactionsQuestion: reactions.question ?? 0,
    replyCount: r.reply_count ?? 0,
    createdAt: r.created_at
  };
}

// ─── Platform-wide Counter side lane ──────────────────────
//
// The Counter is a cross-canteen aggregation query: every post of
// kind='counter' + status='live' fanned into one flowing marketplace
// stream. Sponsored boosts sort first (boost_expires_at in future),
// then chronological. Optional canteenTradeSlug prioritises posts
// targeted at that trade.

export async function platformSideLaneFromDb(canteenTradeSlug?: string): Promise<SideLanePost[]> {
  const nowIso = new Date().toISOString();
  // Both kinds surface on The Counter:
  //   counter    — host-elevated marketplace listings (via Promote button)
  //   make-offer — member-posted "for sale" from the composer's Sell kind
  const res = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .select("id, canteen_id, author_slug, author_display_name, author_avatar_url, kind, body, photo_urls, price_gbp, currency, target_trade_slugs, boost_expires_at, boost_paid_gbp, created_at, expires_at")
    .in("kind", ["counter", "make-offer"])
    .eq("status", "live")
    .order("boost_expires_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);

  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] side lane", res.error);
    return platformSideLaneMock(canteenTradeSlug);
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return platformSideLaneMock(canteenTradeSlug);

  const shaped: SideLanePost[] = rows.map((r) => {
    const boostActive = r.boost_expires_at && Date.parse(r.boost_expires_at) > Date.now();
    return {
      id: r.id,
      canteenId: r.canteen_id ?? "",
      kind: "member-listing",
      posterSlug: r.author_slug,
      posterDisplayName: r.author_display_name,
      headline: (r.body ?? "").slice(0, 90),
      imageUrl: (r.photo_urls ?? [])[0] ?? null,
      priceGbp: r.price_gbp ?? undefined,
      clicksTrailing7d: 0,
      state: "live",
      postedAt: r.created_at,
      expiresAt: r.expires_at ?? nowIso,
      boost: boostActive
        ? {
            expiresAt: r.boost_expires_at as string,
            paidGbp: r.boost_paid_gbp ?? 0,
            targetTradeSlugs: (r.target_trade_slugs ?? undefined) as readonly string[] | undefined
          }
        : undefined
    };
  });

  // Prioritise posts targeting the current canteen's trade — bump
  // them ahead of untargeted posts (boosted-first ordering preserved
  // within each bucket).
  if (canteenTradeSlug) {
    const relevant: SideLanePost[] = [];
    const rest: SideLanePost[] = [];
    for (const p of shaped) {
      const targets = p.boost?.targetTradeSlugs ?? null;
      if (targets && targets.includes(canteenTradeSlug)) relevant.push(p);
      else rest.push(p);
    }
    return [...relevant, ...rest];
  }
  return shaped;
}

// ─── Trade Center browse — real reader ────────────────────

export async function browseAllProductsFromDb(opts?: {
  tradeSlug?: string;
  sort?: BrowseSort;
  q?: string;
  /** Category slug filter — matches `category_slug` column exactly. */
  categorySlug?: string;
  /** Aspect filter — { aspectKey: expectedValue }. Applied client-side
   *  after fetch because JSONB `?` operators aren't cleanly supported
   *  through the JS SDK. Cheap for the current dataset. */
  aspectFilters?: Record<string, string>;
}): Promise<BrowseProductRow[]> {
  // Fetch products + join canteens for trade metadata in one round-trip.
  let q = supabaseAdmin
    .from("hammerex_canteen_products")
    .select(`
      id, canteen_id, host_slug, name, blurb, description, image_url,
      price_gbp, specs, trade_center_listing_id, featured, bulk_buy, boost,
      show_in_canteen_products, show_in_trending, show_in_trade_center,
      category_slug, category_aspects, commerce,
      created_at,
      hammerex_canteens!inner(slug, trade_slug, trade_label, host_display_name, host_slug)
    `)
    // Per-product Trade Center gate. Merchant master switch (send_to_trade_center)
    // still enforced downstream — this is defence-in-depth so a product with
    // show_in_trade_center=false never appears in TC browse under any condition.
    .eq("show_in_trade_center", true);
  if (opts?.q) {
    const safe = opts.q.replace(/[%_,]/g, "");
    if (safe) q = q.or(`name.ilike.%${safe}%,blurb.ilike.%${safe}%`);
  }
  if (opts?.categorySlug) {
    q = q.eq("category_slug", opts.categorySlug);
  }
  const res = await q;

  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] browseAllProducts", res.error);
    return browseAllProductsMock(opts);
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return browseAllProductsMock(opts);

  const nowMs = Date.now();

  // Reviews aggregate map — fetch host ratings from members table in
  // a second round-trip so the card can render the ⭐ chip.
  const hostSlugs = Array.from(new Set(rows.map((r) => r.host_slug))).filter(Boolean);
  const hostRatings = new Map<string, { avg: number; count: number }>();
  if (hostSlugs.length > 0) {
    const memRes = await supabaseAdmin
      .from("hammerex_canteen_members")
      .select("member_slug, reviews_avg, reviews_count")
      .in("member_slug", hostSlugs)
      .not("reviews_count", "is", null);
    for (const m of memRes.data ?? []) {
      const count = (m as { reviews_count: number | null }).reviews_count;
      if (count && count >= 5) {
        hostRatings.set((m as { member_slug: string }).member_slug, {
          avg: Number((m as { reviews_avg: number }).reviews_avg),
          count
        });
      }
    }
  }

  const shaped: BrowseProductRow[] = rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => {
      const canteen = r.hammerex_canteens;
      const boost = r.boost as { expiresAt?: string } | null;
      const isBoosted = !!boost?.expiresAt && Date.parse(boost.expiresAt) > nowMs;
      return {
        product: {
          id: r.id,
          canteenId: r.canteen_id,
          hostSlug: r.host_slug,
          name: r.name,
          blurb: r.blurb ?? "",
          description: r.description ?? "",
          imageUrl: r.image_url ?? "",
          priceGbp: r.price_gbp ?? 0,
          specs: r.specs ?? undefined,
          tradeCenterListingId: r.trade_center_listing_id ?? undefined,
          featured: r.featured ?? false,
          bulkBuy: r.bulk_buy ?? undefined,
          boost: r.boost ?? undefined,
          showInCanteenProducts: r.show_in_canteen_products ?? true,
          showInTrending: r.show_in_trending ?? true,
          showInTradeCenter: r.show_in_trade_center ?? true,
          categorySlug: r.category_slug ?? undefined,
          categoryAspects: r.category_aspects ?? undefined,
          commerce: r.commerce ?? undefined
        } satisfies CanteenProduct,
        hostSlug: canteen.host_slug,
        hostDisplayName: canteen.host_display_name,
        canteenSlug: canteen.slug,
        tradeSlug: canteen.trade_slug,
        tradeLabel: canteen.trade_label,
        href: `/trade-off/yard/canteens/${canteen.slug}?focus=${encodeURIComponent(r.id)}&from=trade-center`,
        isBoosted,
        hostRating: hostRatings.get(canteen.host_slug) ?? null
      };
    })
    .filter((row) => !opts?.tradeSlug || row.tradeSlug === opts.tradeSlug)
    // Aspect filters — every {aspectKey: value} pair must match. Applied
    // post-fetch since JSONB attribute-match through the JS SDK is
    // awkward. Cheap while the dataset is small; move to a Postgres
    // GIN index + `->>` clauses if aspects grow past ~10k listings.
    .filter((row) => {
      const filters = opts?.aspectFilters;
      if (!filters || Object.keys(filters).length === 0) return true;
      const aspects = row.product.categoryAspects ?? {};
      for (const [k, v] of Object.entries(filters)) {
        if (String(aspects[k] ?? "") !== v) return false;
      }
      return true;
    });

  // Sort per opts.sort
  const sort = opts?.sort ?? "boosted";
  if (sort === "price-asc") shaped.sort((a, b) => a.product.priceGbp - b.product.priceGbp);
  else if (sort === "price-desc") shaped.sort((a, b) => b.product.priceGbp - a.product.priceGbp);
  else if (sort === "newest") shaped.reverse();
  else shaped.sort((a, b) => Number(b.isBoosted) - Number(a.isBoosted));

  return shaped;
}

export async function browseTradeFacetsFromDb(): Promise<Array<{ slug: string; label: string; count: number }>> {
  const res = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("hammerex_canteens!inner(trade_slug, trade_label)");
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] browseTradeFacets", res.error);
    return browseTradeFacetsMock();
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return browseTradeFacetsMock();

  const counts = new Map<string, { label: string; count: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of rows as any[]) {
    const c = r.hammerex_canteens;
    if (!c?.trade_slug) continue;
    const existing = counts.get(c.trade_slug);
    if (existing) existing.count += 1;
    else counts.set(c.trade_slug, { label: c.trade_label, count: 1 });
  }
  return Array.from(counts.entries())
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count);
}

/** Category + aspect facets for Trade Center browse.
 *  Returns:
 *    categories — every category with a non-zero listing count
 *    aspectFacets — per-aspect value counts when a category is active
 *                   (empty when no category is picked, to keep the
 *                    facet panel scoped and useful)
 *
 *  Called on every Trade Center browse render. Runs one query;
 *  aggregates in memory. Move to a materialised view if the row count
 *  passes ~50k. */
export async function browseCategoryFacetsFromDb(opts?: {
  activeCategorySlug?: string;
}): Promise<{
  categories: Array<{ slug: string; count: number }>;
  aspectFacets: Array<{ key: string; values: Array<{ value: string; count: number }> }>;
}> {
  const res = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("category_slug, category_aspects")
    .eq("show_in_trade_center", true);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] browseCategoryFacets", res.error);
    return { categories: [], aspectFacets: [] };
  }
  const rows = res.data ?? [];

  const catCounts = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of rows as any[]) {
    if (!r.category_slug) continue;
    catCounts.set(r.category_slug, (catCounts.get(r.category_slug) ?? 0) + 1);
  }
  const categories = Array.from(catCounts.entries())
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count);

  // Aspect facets only calculated when a category is active — otherwise
  // we would surface aspect keys from mismatched categories, which is
  // confusing (e.g. "Wattage" appearing when the user is browsing paint).
  if (!opts?.activeCategorySlug) {
    return { categories, aspectFacets: [] };
  }
  const aspectCounts = new Map<string, Map<string, number>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of rows as any[]) {
    if (r.category_slug !== opts.activeCategorySlug) continue;
    const aspects = (r.category_aspects ?? {}) as Record<string, string | number>;
    for (const [k, v] of Object.entries(aspects)) {
      if (v == null || v === "") continue;
      const str = String(v);
      const inner = aspectCounts.get(k) ?? new Map<string, number>();
      inner.set(str, (inner.get(str) ?? 0) + 1);
      aspectCounts.set(k, inner);
    }
  }
  const aspectFacets = Array.from(aspectCounts.entries()).map(([key, inner]) => ({
    key,
    values: Array.from(inner.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }));

  return { categories, aspectFacets };
}

// ─── Shape helpers ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeCanteen(r: any): Canteen {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline ?? "",
    tradeSlug: r.trade_slug,
    tradeLabel: r.trade_label,
    hostSlug: r.host_slug,
    hostDisplayName: r.host_display_name,
    memberCount: r.member_count ?? 0,
    postsLast30d: r.posts_last_30d ?? 0,
    activityStreakMonths: r.activity_streak_months ?? 0,
    headerBgUrl: r.header_bg_url ?? null,
    createdAt: r.created_at,
    isFounding100: r.is_founding_100 ?? false
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeMember(r: any): CanteenMember {
  const showroom = r.showroom_address_line
    ? { addressLine: r.showroom_address_line, postcode: r.showroom_postcode ?? "" }
    : undefined;
  const verified = (r.verified_companies_house || r.verified_insurance_gbp || r.verified_trust_score)
    ? {
        companiesHouse: r.verified_companies_house ?? undefined,
        insuranceGbp: r.verified_insurance_gbp ?? undefined,
        trustScore: r.verified_trust_score ?? undefined
      }
    : undefined;
  const socials = (r.instagram_handle || r.facebook_handle || r.tiktok_handle || r.youtube_handle || r.website_url)
    ? {
        instagram: r.instagram_handle ?? undefined,
        facebook: r.facebook_handle ?? undefined,
        tiktok: r.tiktok_handle ?? undefined,
        youtube: r.youtube_handle ?? undefined,
        website: r.website_url ?? undefined
      }
    : undefined;
  const reviews = r.reviews_count
    ? { avg: Number(r.reviews_avg ?? 0), count: r.reviews_count }
    : undefined;
  return {
    slug: r.member_slug,
    displayName: r.display_name,
    tradeLabel: r.trade_label,
    city: r.city ?? "",
    avatarUrl: r.avatar_url ?? null,
    role: r.role,
    whatsapp: r.whatsapp ?? null,
    bioShort: r.bio_short ?? "",
    memberOfCanteenSlugs: r.member_of_canteen_slugs ?? [],
    postcodeArea: r.postcode_area ?? undefined,
    officeHours: r.office_hours ?? undefined,
    showroom,
    verified,
    availability: r.availability ?? undefined,
    responseTime: r.response_time ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    socials,
    reviews,
    portfolioCount: r.portfolio_count ?? undefined,
    country: r.country ?? undefined
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeProduct(r: any): CanteenProduct {
  return {
    id: r.id,
    canteenId: r.canteen_id,
    hostSlug: r.host_slug,
    name: r.name,
    blurb: r.blurb ?? "",
    description: r.description ?? "",
    imageUrl: r.image_url ?? "",
    priceGbp: r.price_gbp ?? 0,
    specs: r.specs ?? undefined,
    tradeCenterListingId: r.trade_center_listing_id ?? undefined,
    featured: r.featured ?? false,
    bulkBuy: r.bulk_buy ?? undefined,
    boost: r.boost ?? undefined,
    galleryUrls: Array.isArray(r.gallery_urls) && r.gallery_urls.length > 0 ? r.gallery_urls : undefined,
    videoUrls: Array.isArray(r.video_urls) && r.video_urls.length > 0 ? r.video_urls : undefined,
    // Defaults preserve old behavior: a row with these columns missing
    // (or null from a pre-migration read) is treated as visible on
    // every surface.
    showInCanteenProducts: r.show_in_canteen_products ?? true,
    showInTrending: r.show_in_trending ?? true,
    showInTradeCenter: r.show_in_trade_center ?? true,
    variants: r.variants ?? undefined,
    commerce: r.commerce ?? undefined,
    categorySlug: r.category_slug ?? undefined,
    categoryAspects: r.category_aspects ?? undefined
  };
}
