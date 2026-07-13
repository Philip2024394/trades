// Server-side canteens reader. Same fallback pattern as reviews.server.ts:
// real DB read first, mock fallback when the DB has nothing (early
// lifecycle, migration window, or transient DB error).
//
// Shapes rows into the existing Canteen / CanteenMember / CanteenProduct
// types so consumers (CanteenPageShell, CanteenProfileFocus, Trade
// Center, Notebook, Reviews page) stay unchanged.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Canteen, CanteenMember, CanteenProduct, SideLanePost, BrowseProductRow, BrowseSort } from "@/lib/canteens";
import {
  canteenBySlug as canteenBySlugMock,
  membersForCanteen as membersForCanteenMock,
  adminForCanteen as adminForCanteenMock,
  productsForCanteen as productsForCanteenMock,
  canteenProductById as canteenProductByIdMock,
  canteenHostedByMerchant as canteenHostedByMerchantMock,
  canteenBannerForMerchant as canteenBannerForMerchantMock,
  platformSideLane as platformSideLaneMock,
  browseAllProducts as browseAllProductsMock,
  browseTradeFacets as browseTradeFacetsMock
} from "@/lib/canteens";

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
  if (!isUuid(canteenId)) return membersForCanteenMock(canteenId);
  const res = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("*")
    .eq("canteen_id", canteenId);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] members", res.error);
    return membersForCanteenMock(canteenId);
  }
  const rows = res.data ?? [];
  if (rows.length === 0) return membersForCanteenMock(canteenId);
  return rows.map((r) => shapeMember(r));
}

export async function adminForCanteenFromDb(canteenId: string): Promise<CanteenMember | null> {
  if (!isUuid(canteenId)) return adminForCanteenMock(canteenId);
  const res = await supabaseAdmin
    .from("hammerex_canteen_members")
    .select("*")
    .eq("canteen_id", canteenId)
    .eq("role", "admin")
    .maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.server] admin", res.error);
    return adminForCanteenMock(canteenId);
  }
  if (!res.data) return adminForCanteenMock(canteenId);
  return shapeMember(res.data);
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
}): Promise<BrowseProductRow[]> {
  // Fetch products + join canteens for trade metadata in one round-trip.
  let q = supabaseAdmin
    .from("hammerex_canteen_products")
    .select(`
      id, canteen_id, host_slug, name, blurb, description, image_url,
      price_gbp, specs, trade_center_listing_id, featured, bulk_buy, boost,
      created_at,
      hammerex_canteens!inner(slug, trade_slug, trade_label, host_display_name, host_slug)
    `);
  if (opts?.q) {
    const safe = opts.q.replace(/[%_,]/g, "");
    if (safe) q = q.or(`name.ilike.%${safe}%,blurb.ilike.%${safe}%`);
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
          boost: r.boost ?? undefined
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
    .filter((row) => !opts?.tradeSlug || row.tradeSlug === opts.tradeSlug);

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
    boost: r.boost ?? undefined
  };
}
