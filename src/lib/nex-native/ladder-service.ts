// src/lib/nex-native/ladder-service.ts
//
// NEX Direct Price · ladder-service · reads + writes for
// nex_product_ladder (per-business config) + nex_buyer_tier_progress
// (per-buyer counter). Bridge 49a · sealed 2026-09-29.
//
// See memory/nex_direct_price_swiss_sealed_2026_09_29.md for the
// canonical doctrine (visual family = D6 + B4, share is NEX-only,
// anti-spam 7 days, compare_channel never names Gojek by name).

import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexTimestamp, NexUuid } from "./types";

// ---------------------------------------------------------------------
// Types (mirror migration 087)
// ---------------------------------------------------------------------

export interface LadderTier {
  /** Order number this tier unlocks at (1-indexed · 1 = first order). */
  readonly order: number;
  /** Percentage discount at this tier (0-100 · seller-set). */
  readonly discount: number;
  /** Short human label ("Regular" · "Member for life" · etc.). */
  readonly label: string;
}

export interface NexProductLadderRow {
  business_id: NexUuid;
  tiers: LadderTier[];
  max_cap_pct: number;
  share_friend_bonus_pct: number;
  share_group_bonus_pct: number;
  share_expiry_hours: number;
  compare_channel: string;
  active: boolean;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexBuyerTierProgressRow {
  buyer_account_id: NexUuid;
  business_id: NexUuid;
  order_count: number;
  last_order_at: NexTimestamp | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

/** Founder-approved default tier ladder · matches the migration
 *  DEFAULT clause verbatim. Referenced from both the seller editor
 *  (for the "reset to defaults" button) and the fallback path when a
 *  business hasn't customised its ladder yet. */
export const NEX_DEFAULT_LADDER_TIERS: readonly LadderTier[] = [
  { order: 1, discount: 0, label: "New here" },
  { order: 2, discount: 3, label: "Getting to know us" },
  { order: 4, discount: 5, label: "Regular" },
  { order: 7, discount: 8, label: "We know your order" },
  { order: 12, discount: 15, label: "Member for life" },
];

export const NEX_LADDER_DEFAULTS = {
  max_cap_pct: 15,
  share_friend_bonus_pct: 5,
  share_group_bonus_pct: 7,
  share_expiry_hours: 48,
  compare_channel: "typical delivery app",
} as const;

/** Validation constants · mirror CHECK constraints in migration 087. */
export const NEX_LADDER_LIMITS = {
  maxCapMin: 0,
  maxCapMax: 25,
  shareFriendMin: 0,
  shareFriendMax: 15,
  shareGroupMin: 0,
  shareGroupMax: 20,
  expiryHoursMin: 1,
  expiryHoursMax: 168,
  compareChannelMinLen: 1,
  compareChannelMaxLen: 60,
  compareMarkupMin: 0,
  compareMarkupMax: 60,
  /** Legal-safety: never let sellers name specific competitor apps
   *  in the compare_channel copy. Server rejects. */
  compareChannelDenylist: [
    "gojek",
    "gofood",
    "grab",
    "grabfood",
    "shopeefood",
    "foodpanda",
    "traveloka",
  ] as readonly string[],
} as const;

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

/** Fetch a business's ladder config. Returns null when no row exists
 *  yet (business hasn't opted into Direct Price) · callers should
 *  either fall back to defaults or hide the ladder UI entirely. */
export async function getLadderForBusiness(
  businessId: NexUuid,
): Promise<NexProductLadderRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_ladder")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) {
    throw new Error(`ladder-service.getLadderForBusiness: ${error.message}`);
  }
  return (data as NexProductLadderRow | null) ?? null;
}

/** Fetch the current buyer's progress row for a business. Returns
 *  null when the buyer has never ordered from this business
 *  (callers treat as order_count = 0). */
export async function getBuyerProgress(
  buyerAccountId: NexUuid,
  businessId: NexUuid,
): Promise<NexBuyerTierProgressRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_buyer_tier_progress")
    .select("*")
    .eq("buyer_account_id", buyerAccountId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) {
    throw new Error(`ladder-service.getBuyerProgress: ${error.message}`);
  }
  return (data as NexBuyerTierProgressRow | null) ?? null;
}

// ---------------------------------------------------------------------
// Tier resolution (pure)
// ---------------------------------------------------------------------

/** Bridge 49b-final · Applied Direct Price discount for a cart line
 *  or a whole cart · what the buyer actually receives at checkout.
 *  Both bonuses stack but the sum is capped by ladder.max_cap_pct. */
export interface AppliedDirectPrice {
  /** Discount % from the loyalty tier (buyer's current position). */
  tierPct: number;
  /** Best applicable share-grant bonus % for this buyer+business ·
   *  0 when no grant applies. */
  sharePct: number;
  /** Final % applied · min(tierPct + sharePct, maxCapPct). */
  appliedPct: number;
  /** Whether the sum was clipped by the max-cap. */
  cappedAtMax: boolean;
  /** ID of the grant that contributed sharePct (if any) · used by the
   *  server action to mark the grant consumed after the cart is sent. */
  grantIdConsumed: string | null;
}

/** Pure helper · combine tier + best share bonus + cap. Callers pass
 *  in ladder + grants + buyer id · we do the math. No DB access. */
export function computeAppliedDiscount(input: {
  tierPct: number;
  bestShareBonusPct: number;
  maxCapPct: number;
  grantId: string | null;
}): AppliedDirectPrice {
  const sum = input.tierPct + input.bestShareBonusPct;
  const capped = sum > input.maxCapPct;
  const applied = capped ? input.maxCapPct : sum;
  return {
    tierPct: input.tierPct,
    sharePct: input.bestShareBonusPct,
    appliedPct: applied,
    cappedAtMax: capped,
    grantIdConsumed: input.bestShareBonusPct > 0 ? input.grantId : null,
  };
}

/** Convenience helper · fetches ladder + progress + grants and
 *  returns the resolved AppliedDirectPrice for a (buyer, business).
 *  Callers use this at cart-send time to compute the final % applied
 *  before writing the snapshot. Returns a zero-discount stub when
 *  the shop has no ladder or the ladder is paused. */
export async function resolveAppliedDiscountForBuyer(
  buyerAccountId: NexUuid,
  businessId: NexUuid,
): Promise<AppliedDirectPrice> {
  const [ladder, progress] = await Promise.all([
    getLadderForBusiness(businessId),
    getBuyerProgress(buyerAccountId, businessId),
  ]);
  if (!ladder || !ladder.active) {
    return {
      tierPct: 0,
      sharePct: 0,
      appliedPct: 0,
      cappedAtMax: false,
      grantIdConsumed: null,
    };
  }
  const position = resolveTierPosition(progress?.order_count ?? 0, ladder.tiers);
  const tierPct = position.currentTier.discount;

  // Dynamic import · avoid a circular dep with share-service which
  // imports back into ladder-service.
  const shareSvc = await import("./share-service");
  const grants = await shareSvc.listActiveGrantsFor(buyerAccountId, businessId);
  const bestShare = shareSvc.pickBestBonusPct(
    grants,
    buyerAccountId,
    ladder.max_cap_pct,
  );
  // Find the grant whose bonus matches bestShare so we know which id
  // to mark consumed. First matching grant wins · deterministic order
  // (most-recent-first from listActiveGrantsFor).
  const contributingGrant = grants.find((g) => {
    const isSharer = g.sharer_account_id === buyerAccountId;
    const bonus = isSharer ? g.sharer_bonus_pct : g.receiver_bonus_pct;
    return bonus === bestShare && bestShare > 0;
  });
  return computeAppliedDiscount({
    tierPct,
    bestShareBonusPct: bestShare,
    maxCapPct: ladder.max_cap_pct,
    grantId: contributingGrant?.id ?? null,
  });
}

/** Given a buyer's order count and a ladder, resolve which tier they
 *  are currently on, and what the next unlock is. Pure function ·
 *  safe to call anywhere · no DB access. */
export function resolveTierPosition(
  orderCount: number,
  tiers: readonly LadderTier[],
): {
  currentTier: LadderTier;
  currentTierIndex: number;
  nextTier: LadderTier | null;
  nextTierIndex: number | null;
} {
  const sorted = [...tiers].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) {
    // Empty ladder · every buyer is "new"
    const fallback: LadderTier = { order: 1, discount: 0, label: "New here" };
    return { currentTier: fallback, currentTierIndex: 0, nextTier: null, nextTierIndex: null };
  }
  // Buyer's tier is the highest-order tier whose `order` is ≤ (orderCount + 1)
  // because the tier tells you what your NEXT order will be at.
  // Example: 3 completed orders → your next order (the 4th) is at order 4 tier.
  const nextOrderNumber = orderCount + 1;
  let idx = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i]!.order <= nextOrderNumber) {
      idx = i;
    } else {
      break;
    }
  }
  const currentTier = sorted[idx]!;
  const nextTier = sorted[idx + 1] ?? null;
  return {
    currentTier,
    currentTierIndex: idx,
    nextTier,
    nextTierIndex: nextTier ? idx + 1 : null,
  };
}

// ---------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------

export interface NexProductLadderUpsertInput {
  business_id: NexUuid;
  tiers?: LadderTier[];
  max_cap_pct?: number;
  share_friend_bonus_pct?: number;
  share_group_bonus_pct?: number;
  share_expiry_hours?: number;
  compare_channel?: string;
  active?: boolean;
}

function assertTierList(tiers: readonly LadderTier[]): void {
  if (tiers.length === 0) return; // empty is allowed · seller cleared their ladder
  const seenOrders = new Set<number>();
  let prevOrder = 0;
  let prevDiscount = -1;
  for (const t of tiers) {
    if (!Number.isInteger(t.order) || t.order < 1 || t.order > 999) {
      throw new Error(
        `ladder-service: tier order must be integer 1-999 · got ${t.order}`,
      );
    }
    if (seenOrders.has(t.order)) {
      throw new Error(
        `ladder-service: duplicate tier order ${t.order} · orders must be unique`,
      );
    }
    seenOrders.add(t.order);
    if (t.order <= prevOrder) {
      throw new Error(
        `ladder-service: tiers must be sorted by order ascending · got ${t.order} after ${prevOrder}`,
      );
    }
    if (!Number.isInteger(t.discount) || t.discount < 0 || t.discount > 100) {
      throw new Error(
        `ladder-service: tier discount must be integer 0-100 · got ${t.discount}`,
      );
    }
    // Monotonic: discount can only rise (Founder doctrine: progressive tiers).
    if (t.discount < prevDiscount) {
      throw new Error(
        `ladder-service: tier discount must not fall as order rises · got ${t.discount} after ${prevDiscount}`,
      );
    }
    if (typeof t.label !== "string" || t.label.trim().length === 0 || t.label.length > 40) {
      throw new Error(
        `ladder-service: tier label must be 1-40 chars · got ${JSON.stringify(t.label)}`,
      );
    }
    prevOrder = t.order;
    prevDiscount = t.discount;
  }
}

function assertCompareChannel(text: string): void {
  const trimmed = text.trim();
  if (
    trimmed.length < NEX_LADDER_LIMITS.compareChannelMinLen ||
    trimmed.length > NEX_LADDER_LIMITS.compareChannelMaxLen
  ) {
    throw new Error(
      `ladder-service: compare_channel must be ${NEX_LADDER_LIMITS.compareChannelMinLen}-${NEX_LADDER_LIMITS.compareChannelMaxLen} chars`,
    );
  }
  const lower = trimmed.toLowerCase();
  for (const banned of NEX_LADDER_LIMITS.compareChannelDenylist) {
    if (lower.includes(banned)) {
      throw new Error(
        `ladder-service: compare_channel cannot name specific competitors (found "${banned}"). Use a generic phrase like "typical delivery app".`,
      );
    }
  }
}

/** Insert or update a business's ladder config. Returns the row after
 *  write. Validates every field against migration 087 CHECKs + the
 *  extra doctrinal rules (no competitor names, monotonic tiers).
 *  Seller-facing action calls this. */
export async function upsertLadder(
  input: NexProductLadderUpsertInput,
): Promise<NexProductLadderRow> {
  if (!input.business_id) {
    throw new Error("ladder-service.upsertLadder: business_id required");
  }
  if (input.tiers !== undefined) assertTierList(input.tiers);
  if (input.compare_channel !== undefined) assertCompareChannel(input.compare_channel);
  if (
    input.max_cap_pct !== undefined &&
    (input.max_cap_pct < NEX_LADDER_LIMITS.maxCapMin ||
      input.max_cap_pct > NEX_LADDER_LIMITS.maxCapMax)
  ) {
    throw new Error(
      `ladder-service: max_cap_pct out of range ${NEX_LADDER_LIMITS.maxCapMin}-${NEX_LADDER_LIMITS.maxCapMax}`,
    );
  }
  if (
    input.share_friend_bonus_pct !== undefined &&
    (input.share_friend_bonus_pct < NEX_LADDER_LIMITS.shareFriendMin ||
      input.share_friend_bonus_pct > NEX_LADDER_LIMITS.shareFriendMax)
  ) {
    throw new Error(
      `ladder-service: share_friend_bonus_pct out of range ${NEX_LADDER_LIMITS.shareFriendMin}-${NEX_LADDER_LIMITS.shareFriendMax}`,
    );
  }
  if (
    input.share_group_bonus_pct !== undefined &&
    (input.share_group_bonus_pct < NEX_LADDER_LIMITS.shareGroupMin ||
      input.share_group_bonus_pct > NEX_LADDER_LIMITS.shareGroupMax)
  ) {
    throw new Error(
      `ladder-service: share_group_bonus_pct out of range ${NEX_LADDER_LIMITS.shareGroupMin}-${NEX_LADDER_LIMITS.shareGroupMax}`,
    );
  }
  if (
    input.share_expiry_hours !== undefined &&
    (input.share_expiry_hours < NEX_LADDER_LIMITS.expiryHoursMin ||
      input.share_expiry_hours > NEX_LADDER_LIMITS.expiryHoursMax)
  ) {
    throw new Error(
      `ladder-service: share_expiry_hours out of range ${NEX_LADDER_LIMITS.expiryHoursMin}-${NEX_LADDER_LIMITS.expiryHoursMax}`,
    );
  }

  // Merge with existing row (or defaults) so the caller can PATCH
  // partial updates without needing to send the whole ladder.
  const existing = await getLadderForBusiness(input.business_id);
  const merged = {
    business_id: input.business_id,
    tiers: input.tiers ?? existing?.tiers ?? [...NEX_DEFAULT_LADDER_TIERS],
    max_cap_pct: input.max_cap_pct ?? existing?.max_cap_pct ?? NEX_LADDER_DEFAULTS.max_cap_pct,
    share_friend_bonus_pct:
      input.share_friend_bonus_pct ??
      existing?.share_friend_bonus_pct ??
      NEX_LADDER_DEFAULTS.share_friend_bonus_pct,
    share_group_bonus_pct:
      input.share_group_bonus_pct ??
      existing?.share_group_bonus_pct ??
      NEX_LADDER_DEFAULTS.share_group_bonus_pct,
    share_expiry_hours:
      input.share_expiry_hours ??
      existing?.share_expiry_hours ??
      NEX_LADDER_DEFAULTS.share_expiry_hours,
    compare_channel:
      input.compare_channel?.trim() ??
      existing?.compare_channel ??
      NEX_LADDER_DEFAULTS.compare_channel,
    active: input.active ?? existing?.active ?? true,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_ladder")
    .upsert(merged, { onConflict: "business_id" })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `ladder-service.upsertLadder: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexProductLadderRow;
}

// ---------------------------------------------------------------------
// Bridge 49-analytics · seller-facing performance snapshot
// ---------------------------------------------------------------------

export interface LadderAnalyticsSnapshot {
  /** How many buyers have ordered from this shop at all (order_count >= 1). */
  totalBuyers: number;
  /** Distribution across the seller's tier boundaries · returns
   *  {tier_label, buyerCount} entries in tier order. Buyers with
   *  order_count > highest_tier.order fall into the top bucket. */
  tierBuckets: Array<{ tierLabel: string; tierOrder: number; buyerCount: number }>;
  /** Grants sent in the last 30 days (viral loop volume). */
  grantsSent30d: number;
  /** Of those, how many were consumed (sharer or receiver placed an
   *  order applying the grant). */
  grantsConsumed30d: number;
  /** Sum of the receiver_bonus_pct on grants consumed by the receiver ·
   *  proxy for "% discount value handed out" · in whole percentage
   *  points (e.g. 45 means 9 receivers each got −5%). */
  receiverBonusHandedOut30dPct: number;
  /** Buyers ordered from this shop at least once in the last 30 days ·
   *  measured by last_order_at on nex_buyer_tier_progress. */
  activeBuyers30d: number;
}

/** Snapshot of ladder performance for a business · used by the seller
 *  metrics panel on /manage/ladder. Non-fatal per query · returns
 *  zeros when a table is empty rather than throwing. */
export async function getLadderAnalytics(
  businessId: NexUuid,
): Promise<LadderAnalyticsSnapshot> {
  const ladder = await getLadderForBusiness(businessId);
  const tiers = ladder?.tiers ?? [...NEX_DEFAULT_LADDER_TIERS];
  const sorted = [...tiers].sort((a, b) => a.order - b.order);

  const thirtyDaysAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Fire all queries in parallel · one round-trip.
  const [
    progressRows,
    grantsSentRes,
    grantsConsumedRes,
    activeBuyersRes,
  ] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_buyer_tier_progress")
      .select("buyer_account_id, order_count")
      .eq("business_id", businessId),
    nexSupabaseAdmin
      .from("nex_product_share_grant")
      .select("id, receiver_bonus_pct", { count: "exact" })
      .eq("business_id", businessId)
      .gte("created_at", thirtyDaysAgoIso),
    nexSupabaseAdmin
      .from("nex_product_share_grant")
      .select("id, receiver_bonus_pct, consumed_by_sharer_at, consumed_by_receiver_at")
      .eq("business_id", businessId)
      .gte("created_at", thirtyDaysAgoIso)
      .or("consumed_by_sharer_at.not.is.null,consumed_by_receiver_at.not.is.null"),
    nexSupabaseAdmin
      .from("nex_buyer_tier_progress")
      .select("buyer_account_id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("last_order_at", thirtyDaysAgoIso),
  ]);

  const progress = (progressRows.data as { order_count: number }[] | null) ?? [];
  const buyers = progress.filter((p) => p.order_count >= 1);

  // Bucketise buyers into tiers · tierN captures buyers whose next
  // order would land at tier N (i.e. order_count in [tier.order - 1, next.order - 2]).
  const buckets = sorted.map((t, i) => {
    const next = sorted[i + 1];
    const lowerBound = t.order - 1;
    const upperBound = next ? next.order - 2 : Number.POSITIVE_INFINITY;
    const buyerCount = buyers.filter(
      (b) => b.order_count >= lowerBound && b.order_count <= upperBound,
    ).length;
    return {
      tierLabel: t.label,
      tierOrder: t.order,
      buyerCount,
    };
  });

  const grantsConsumedRows =
    (grantsConsumedRes.data as { receiver_bonus_pct: number }[] | null) ?? [];
  const receiverBonusHandedOut30dPct = grantsConsumedRows.reduce(
    (sum, r) => sum + (r.receiver_bonus_pct ?? 0),
    0,
  );

  return {
    totalBuyers: buyers.length,
    tierBuckets: buckets,
    grantsSent30d: grantsSentRes.count ?? 0,
    grantsConsumed30d: grantsConsumedRes.data?.length ?? 0,
    receiverBonusHandedOut30dPct,
    activeBuyers30d: activeBuyersRes.count ?? 0,
  };
}

/** Increment the buyer's order count for a business. Called from the
 *  order-completion hook (Bridge 49b) after a real order is marked
 *  fulfilled.
 *
 *  Read-modify-write pattern · NOT strictly atomic. Concurrent
 *  double-orders from the same buyer to the same business could lose
 *  one increment, which is acceptable for a loyalty counter (worst
 *  case: buyer needs one extra order to unlock the next tier). If
 *  this becomes a real issue, replace with a SQL RPC that runs
 *  `INSERT ... ON CONFLICT DO UPDATE SET order_count = order_count + 1`
 *  in a single statement. */
export async function incrementBuyerProgress(
  buyerAccountId: NexUuid,
  businessId: NexUuid,
): Promise<NexBuyerTierProgressRow> {
  const existing = await getBuyerProgress(buyerAccountId, businessId);
  const nowIso = new Date().toISOString();

  if (!existing) {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_buyer_tier_progress")
      .insert({
        buyer_account_id: buyerAccountId,
        business_id: businessId,
        order_count: 1,
        last_order_at: nowIso,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(
        `ladder-service.incrementBuyerProgress insert: ${error?.message ?? "no row"}`,
      );
    }
    return data as NexBuyerTierProgressRow;
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_buyer_tier_progress")
    .update({
      order_count: existing.order_count + 1,
      last_order_at: nowIso,
    })
    .eq("buyer_account_id", buyerAccountId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `ladder-service.incrementBuyerProgress update: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBuyerTierProgressRow;
}
