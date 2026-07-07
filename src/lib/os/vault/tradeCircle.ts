// OS — Trade Circle rendering helpers.
//
// Two-mode render: curated edges first (from os_business_endorsements),
// then auto-populated fills from the paid pool of nearby merchants in
// COMPLEMENTARY trades (different-category filter), daily-seeded
// rotation so the same visitor sees a stable set within a day but the
// pool rotates over time.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TradeCircleMember = {
  businessId: string;
  slug: string;
  displayName: string;
  primaryTrade: string;
  city: string | null;
  avatarUrl: string | null;
  photos: string[];
  tier: string;
  verified: boolean;
  isCurated: boolean;
  isReciprocal: boolean;
  isInvited: boolean;
  isAutoPopulated: boolean;
  categoryLabel: string | null;
  attribution: string; // e.g. "Recommended by <owner>" for auto-populated
};

export type TradeCircleContext = {
  hostBusinessId: string;
  hostSlug: string;
  hostDisplayName: string;
  hostPrimaryTrade: string;
  hostSecondaryTrades: string[];
  hostCity: string | null;
  hostLat: number | null;
  hostLng: number | null;
  hostEcosystemParticipation: boolean;
};

const PAID_TIERS = ["premium", "verified", "merchant_pro"];
const AUTO_POPULATE_RADIUS_MILES = 25;
const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  // Deterministic Fisher-Yates driven by a numeric hash of `seed`. Same
  // seed → same order. Rotates daily when caller supplies a per-day seed.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function loadTradeCircleContext(
  hostBusinessId: string
): Promise<TradeCircleContext | null> {
  const { data } = await supabaseAdmin
    .from("os_business_listings")
    .select(
      "id, slug, display_name, primary_trade, secondary_trades, city, lat, lng, ecosystem_participation"
    )
    .eq("id", hostBusinessId)
    .maybeSingle();
  if (!data) return null;
  return {
    hostBusinessId: data.id,
    hostSlug: data.slug,
    hostDisplayName: data.display_name,
    hostPrimaryTrade: data.primary_trade,
    hostSecondaryTrades: data.secondary_trades ?? [],
    hostCity: data.city ?? null,
    hostLat: data.lat ? Number(data.lat) : null,
    hostLng: data.lng ? Number(data.lng) : null,
    hostEcosystemParticipation: Boolean(data.ecosystem_participation)
  };
}

async function loadCurated(
  ctx: TradeCircleContext
): Promise<TradeCircleMember[]> {
  const { data } = await supabaseAdmin
    .from("os_business_endorsements")
    .select(
      `id, endorsed_business_id, source, display_order, pinned, category_id,
       category:os_business_endorsement_categories(label),
       endorsed:os_business_listings!os_business_endorsements_endorsed_business_id_fkey(
         id, slug, display_name, primary_trade, city, avatar_url, photos, tier,
         verified, status, ecosystem_participation, deleted_at
       )`
    )
    .eq("endorser_business_id", ctx.hostBusinessId)
    .eq("hidden", false)
    .order("pinned", { ascending: false })
    .order("display_order", { ascending: true });

  const rows = (data ?? []) as Array<{
    id: string;
    source: string;
    display_order: number;
    pinned: boolean;
    category: { label: string } | null;
    endorsed: {
      id: string;
      slug: string;
      display_name: string;
      primary_trade: string;
      city: string | null;
      avatar_url: string | null;
      photos: string[] | null;
      tier: string;
      verified: boolean;
      status: string;
      ecosystem_participation: boolean;
      deleted_at: string | null;
    } | null;
  }>;

  const members: TradeCircleMember[] = [];
  for (const row of rows) {
    const t = row.endorsed;
    if (!t) continue;
    if (t.deleted_at) continue;
    if (t.status !== "live") continue;
    if (!t.ecosystem_participation) continue; // opted out — hidden per reciprocity rule
    members.push({
      businessId: t.id,
      slug: t.slug,
      displayName: t.display_name,
      primaryTrade: t.primary_trade,
      city: t.city ?? null,
      avatarUrl: t.avatar_url ?? null,
      photos: t.photos ?? [],
      tier: t.tier,
      verified: t.verified,
      isCurated: row.source === "curated",
      isReciprocal: row.source === "reciprocal",
      isInvited: row.source === "invited",
      isAutoPopulated: false,
      categoryLabel: row.category?.label ?? null,
      attribution: `Recommended by ${ctx.hostDisplayName}`
    });
  }
  return members;
}

async function loadAutoPopulated(
  ctx: TradeCircleContext,
  excludeIds: Set<string>,
  limit: number,
  daySeed: string
): Promise<TradeCircleMember[]> {
  if (limit <= 0) return [];
  const excludeTrades = new Set(
    [ctx.hostPrimaryTrade, ...ctx.hostSecondaryTrades].filter(Boolean)
  );

  const { data } = await supabaseAdmin
    .from("os_business_listings")
    .select(
      "id, slug, display_name, primary_trade, city, avatar_url, photos, tier, verified, lat, lng"
    )
    .in("tier", PAID_TIERS)
    .eq("status", "live")
    .eq("ecosystem_participation", true)
    .is("deleted_at", null);

  const candidates = (data ?? []).filter((c) => {
    if (excludeIds.has(c.id)) return false;
    if (excludeTrades.has(c.primary_trade)) return false; // complementary only
    return true;
  });

  // Distance filter if we know the host's coordinates
  const withinRadius = candidates.filter((c) => {
    if (ctx.hostLat === null || ctx.hostLng === null) return true;
    if (!c.lat || !c.lng) return true; // include when target coords unknown
    const dist = haversineMiles(
      ctx.hostLat,
      ctx.hostLng,
      Number(c.lat),
      Number(c.lng)
    );
    return dist <= AUTO_POPULATE_RADIUS_MILES;
  });

  // Daily-seeded rotation
  const seeded = seededShuffle(
    withinRadius,
    `${ctx.hostBusinessId}:${daySeed}`
  );

  return seeded.slice(0, limit).map((t) => ({
    businessId: t.id,
    slug: t.slug,
    displayName: t.display_name,
    primaryTrade: t.primary_trade,
    city: t.city ?? null,
    avatarUrl: t.avatar_url ?? null,
    photos: t.photos ?? [],
    tier: t.tier,
    verified: t.verified,
    isCurated: false,
    isReciprocal: false,
    isInvited: false,
    isAutoPopulated: true,
    categoryLabel: null,
    attribution: `Local trusted ${t.primary_trade.replace(/-/g, " ")}`
  }));
}

export async function loadTradeCircle(
  hostBusinessIdOrSlug: string,
  limit = 12
): Promise<{
  members: TradeCircleMember[];
  host: TradeCircleContext | null;
}> {
  // Accept business id OR slug
  let ctx: TradeCircleContext | null = null;
  if (hostBusinessIdOrSlug.includes("-") && hostBusinessIdOrSlug.length === 36) {
    ctx = await loadTradeCircleContext(hostBusinessIdOrSlug);
  }
  if (!ctx) {
    const { data } = await supabaseAdmin
      .from("os_business_listings")
      .select("id")
      .eq("slug", hostBusinessIdOrSlug)
      .maybeSingle();
    if (data) ctx = await loadTradeCircleContext(data.id);
  }
  if (!ctx) return { members: [], host: null };
  if (!ctx.hostEcosystemParticipation) {
    // Host opted out — show only their curated network (their own choices
    // remain visible on their own page), no auto-populated fills.
    const curated = await loadCurated(ctx);
    return { members: curated.slice(0, limit), host: ctx };
  }

  const curated = await loadCurated(ctx);
  const excludeIds = new Set(curated.map((m) => m.businessId));
  excludeIds.add(ctx.hostBusinessId);
  const remaining = limit - curated.length;
  const daySeed = new Date().toISOString().slice(0, 10);
  const auto = await loadAutoPopulated(ctx, excludeIds, remaining, daySeed);

  return {
    members: [...curated, ...auto].slice(0, limit),
    host: ctx
  };
}
